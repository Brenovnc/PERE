using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Domain.Enums;
using StudyPlatform.Api.DTOs.Progress;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Models.Activities;

namespace StudyPlatform.Api.Services.Progress;

public sealed class TeacherStatisticsService(ApplicationDbContext db, TimeProvider clock)
{
    private static readonly ActivityType[] ScoredTypes =
        [ActivityType.TrueFalse, ActivityType.FillBlank, ActivityType.GuessConcept, ActivityType.Ordering];

    public async Task<TeacherDashboardStatisticsResponse> GetDashboardAsync(Guid teacherId, int days, string? from, string? to, Guid? classroomId, Guid? moduleId, string? activityType, CancellationToken ct)
    {
        var range = ParseRange(days, from, to);
        var filterType = ParseActivityType(activityType);
        var classroomsQuery = db.Classrooms.AsNoTracking()
            .Where(item => item.TeacherId == teacherId && item.Status == ClassroomStatus.Active);
        if (classroomId.HasValue)
        {
            var owned = await db.Classrooms.AnyAsync(item => item.Id == classroomId.Value && item.TeacherId == teacherId, ct);
            if (!owned) throw NotFound("A turma selecionada não pertence à sua conta.");
            classroomsQuery = classroomsQuery.Where(item => item.Id == classroomId.Value);
        }
        if (moduleId.HasValue)
        {
            classroomsQuery = classroomsQuery.Where(item => item.ClassroomModules.Any(link => link.ModuleId == moduleId.Value
                && link.Module.Status == ModuleStatus.Published && !link.Module.IsCommunityListing));
        }
        var classrooms = await classroomsQuery.Select(item => new ClassroomInfo(item.Id, item.Name)).ToListAsync(ct);
        var scopes = await LoadScopesAsync(classrooms, moduleId, activeStudentsOnly: true, ct);
        var students = scopes.SelectMany(scope => scope.Students).DistinctBy(student => student.Id).ToArray();
        var concepts = scopes.SelectMany(scope => scope.Concepts).DistinctBy(concept => concept.Id).ToArray();
        var states = await GetStatesAsync(students.Select(item => item.Id).ToArray(), concepts.Select(item => item.Id).ToArray(), ct);
        var distribution = Distribution(students, concepts, states);
        var modules = scopes.SelectMany(scope => scope.ModuleIds).Distinct().ToArray();
        var daily = await GetDailyRowsAsync(students.Select(item => item.Id).ToArray(), modules, range, ct);
        var comparison = scopes.Select(scope =>
        {
            var progress = scope.Students.Select(student => Percent(
                scope.Concepts.Count(concept => states.GetValueOrDefault((student.Id, concept.Id)) == LearningState.Mastered),
                scope.Concepts.Count)).ToArray();
            return new ClassroomComparisonStatistics(scope.ClassroomId, scope.ClassroomName,
                scope.Students.Count, progress.Length == 0 ? 0 : progress.Average());
        }).ToArray();
        return new TeacherDashboardStatisticsResponse(distribution, Daily(daily, range, filterType), comparison);
    }

    public async Task<ClassroomStatisticsResponse> GetClassroomAsync(Guid teacherId, Guid classroomId, int days, string? from, string? to, Guid? moduleId, string? activityType, int minAttempts, CancellationToken ct)
    {
        var range = ParseRange(days, from, to);
        var filterType = ParseActivityType(activityType);
        if (minAttempts is not (3 or 5 or 10)) throw InvalidFilter("O mínimo de tentativas deve ser 3, 5 ou 10.");
        var classroom = await db.Classrooms.AsNoTracking()
            .Where(item => item.Id == classroomId && item.TeacherId == teacherId)
            .Select(item => new ClassroomInfo(item.Id, item.Name)).SingleOrDefaultAsync(ct)
            ?? throw NotFound("A turma não foi encontrada.");
        var scope = (await LoadScopesAsync([classroom], moduleId, activeStudentsOnly: false, ct)).Single();
        if (moduleId.HasValue && scope.ModuleIds.Length == 0) throw ModuleNotLinked();
        var studentIds = scope.Students.Select(item => item.Id).ToArray();
        var states = await GetStatesAsync(studentIds, scope.Concepts.Select(item => item.Id).ToArray(), ct);
        var daily = await GetDailyRowsAsync(studentIds, scope.ModuleIds, range, ct);
        var byConcept = await GetConceptRowsAsync(studentIds, scope.ModuleIds, range, ct);
        return new ClassroomStatisticsResponse(Distribution(scope.Students, scope.Concepts, states),
            Daily(daily, range, filterType), TypeStatistics(byConcept, filterType),
            ErrorConcepts(byConcept, minAttempts, filterType), ProgressBands(scope.Students, scope.Concepts, states));
    }

    public async Task<StudentStatisticsResponse> GetStudentAsync(Guid teacherId, Guid classroomId, Guid studentId,
        int days, string? from, string? to, Guid? moduleId, string? activityType, CancellationToken ct)
    {
        var range = ParseRange(days, from, to);
        var filterType = ParseActivityType(activityType);
        var student = await db.Enrollments.AsNoTracking()
            .Where(item => item.StudentId == studentId && item.ClassroomId == classroomId
                && item.Status == EnrollmentStatus.Approved && item.Classroom.TeacherId == teacherId)
            .Select(item => new StudentInfo(item.StudentId)).SingleOrDefaultAsync(ct)
            ?? throw NotFound("O aluno não foi encontrado nesta turma.");
        var moduleIds = await PublishedLinks([classroomId], moduleId).Select(link => link.ModuleId).ToArrayAsync(ct);
        if (moduleId.HasValue && moduleIds.Length == 0) throw ModuleNotLinked();
        var concepts = moduleIds.Length == 0 ? [] : await db.Concepts.AsNoTracking()
            .Where(concept => concept.IsActive && moduleIds.Contains(concept.ModuleId))
            .Select(concept => new ConceptInfo(concept.Id, concept.Name)).ToListAsync(ct);
        var states = await GetStatesAsync([student.Id], concepts.Select(item => item.Id).ToArray(), ct);
        var daily = await GetDailyRowsAsync([student.Id], moduleIds, range, ct);
        var byConcept = await GetConceptRowsAsync([student.Id], moduleIds, range, ct);
        return new StudentStatisticsResponse(Distribution([student], concepts, states),
            Daily(daily, range, filterType), TypeStatistics(byConcept, filterType), ErrorConcepts(byConcept, 3, filterType));
    }

    // Loads modules, students and concepts of all classrooms with one query each, instead of a query loop per classroom.
    private async Task<List<ClassroomData>> LoadScopesAsync(IReadOnlyList<ClassroomInfo> classrooms, Guid? requestedModuleId, bool activeStudentsOnly, CancellationToken ct)
    {
        if (classrooms.Count == 0) return [];
        var classroomIds = classrooms.Select(item => item.Id).ToArray();
        var links = await PublishedLinks(classroomIds, requestedModuleId)
            .Select(link => new { link.ClassroomId, link.ModuleId }).ToListAsync(ct);
        var studentsQuery = db.Enrollments.AsNoTracking()
            .Where(e => classroomIds.Contains(e.ClassroomId) && e.Status == EnrollmentStatus.Approved);
        if (activeStudentsOnly) studentsQuery = studentsQuery.Where(e => e.Student.IsActive);
        var students = await studentsQuery.Select(e => new { e.ClassroomId, Id = e.StudentId }).ToListAsync(ct);
        var moduleIds = links.Select(link => link.ModuleId).Distinct().ToArray();
        var concepts = moduleIds.Length == 0 ? [] : await db.Concepts.AsNoTracking()
            .Where(concept => concept.IsActive && moduleIds.Contains(concept.ModuleId))
            .Select(concept => new { concept.ModuleId, concept.Id, concept.Name }).ToListAsync(ct);

        return classrooms.Select(classroom =>
        {
            var classroomModules = links.Where(link => link.ClassroomId == classroom.Id).Select(link => link.ModuleId).ToArray();
            return new ClassroomData(classroom.Id, classroom.Name, classroomModules,
                students.Where(student => student.ClassroomId == classroom.Id).Select(student => new StudentInfo(student.Id)).ToList(),
                concepts.Where(concept => classroomModules.Contains(concept.ModuleId)).Select(concept => new ConceptInfo(concept.Id, concept.Name)).ToList());
        }).ToList();
    }

    private IQueryable<Models.ClassroomModule> PublishedLinks(Guid[] classroomIds, Guid? requestedModuleId)
    {
        var query = db.ClassroomModules.AsNoTracking().Where(link => classroomIds.Contains(link.ClassroomId)
            && link.Module.Status == ModuleStatus.Published && !link.Module.IsCommunityListing);
        return requestedModuleId.HasValue ? query.Where(link => link.ModuleId == requestedModuleId.Value) : query;
    }

    private async Task<Dictionary<(Guid StudentId, Guid ConceptId), LearningState>> GetStatesAsync(Guid[] studentIds, Guid[] conceptIds, CancellationToken ct)
    {
        if (studentIds.Length == 0 || conceptIds.Length == 0) return [];
        var rows = await db.StudentConceptStates.AsNoTracking()
            .Where(state => studentIds.Contains(state.StudentId) && conceptIds.Contains(state.ConceptId))
            .Select(state => new { state.StudentId, state.ConceptId, state.LearningState }).ToListAsync(ct);
        return rows.ToDictionary(row => (row.StudentId, row.ConceptId), row => row.LearningState);
    }

    private IQueryable<ActivityAttempt> AttemptsQuery(Guid[] studentIds, Guid[] moduleIds, DateRange range)
    {
        var start = range.Start.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = range.End.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        return db.ActivityAttempts.AsNoTracking()
            .Where(attempt => studentIds.Contains(attempt.StudentId) && moduleIds.Contains(attempt.Concept.ModuleId)
                && attempt.StudySession.Mode == StudySessionMode.Normal
                && attempt.AnsweredAtUtc >= start && attempt.AnsweredAtUtc < end);
    }

    // Aggregated in SQL (GROUP BY day and type): only a few rows per day travel from the database.
    private async Task<List<DailyRow>> GetDailyRowsAsync(Guid[] studentIds, Guid[] moduleIds, DateRange range, CancellationToken ct)
    {
        if (studentIds.Length == 0 || moduleIds.Length == 0) return [];
        var rows = await AttemptsQuery(studentIds, moduleIds, range)
            .GroupBy(attempt => new { Day = attempt.AnsweredAtUtc.Date, Type = attempt.ActivityType })
            .Select(group => new { group.Key.Day, group.Key.Type, Total = group.Count(), Correct = group.Count(attempt => attempt.WasCorrect) })
            .ToListAsync(ct);
        return rows.Select(row => new DailyRow(DateOnly.FromDateTime(row.Day), row.Type, row.Total, row.Correct)).ToList();
    }

    private async Task<List<ConceptTypeRow>> GetConceptRowsAsync(Guid[] studentIds, Guid[] moduleIds, DateRange range, CancellationToken ct)
    {
        if (studentIds.Length == 0 || moduleIds.Length == 0) return [];
        return await AttemptsQuery(studentIds, moduleIds, range)
            .GroupBy(attempt => new { attempt.ConceptId, attempt.Concept.Name, Type = attempt.ActivityType })
            .Select(group => new ConceptTypeRow(group.Key.ConceptId, group.Key.Name, group.Key.Type,
                group.Count(), group.Count(attempt => attempt.WasCorrect)))
            .ToListAsync(ct);
    }

    private static IReadOnlyList<DailyLearningStatistics> Daily(List<DailyRow> rows, DateRange range, ActivityType? filterType)
    {
        var filtered = rows.Where(row => filterType is null || row.Type == filterType).ToArray();
        var count = range.End.DayNumber - range.Start.DayNumber + 1;
        return Enumerable.Range(0, count).Select(offset =>
        {
            var date = range.Start.AddDays(offset);
            var daily = filtered.Where(row => row.Date == date).ToArray();
            var scored = daily.Where(row => ScoredTypes.Contains(row.Type)).ToArray();
            var scoredTotal = scored.Sum(row => row.Total);
            return new DailyLearningStatistics(date, daily.Sum(row => row.Total),
                scoredTotal == 0 ? null : Percent(scored.Sum(row => row.Correct), scoredTotal));
        }).ToArray();
    }

    private static IReadOnlyList<ActivityTypeStatistics> TypeStatistics(List<ConceptTypeRow> rows, ActivityType? filterType) =>
        ScoredTypes.Where(type => filterType is null || type == filterType).Select(type =>
        {
            var matching = rows.Where(row => row.Type == type).ToArray();
            var total = matching.Sum(row => row.Total);
            var correct = matching.Sum(row => row.Correct);
            var label = type switch
            {
                ActivityType.TrueFalse => "TRUE_FALSE",
                ActivityType.FillBlank => "FILL_BLANK",
                ActivityType.GuessConcept => "GUESS_CONCEPT",
                ActivityType.Ordering => "ORDERING",
                _ => type.ToString().ToUpperInvariant(),
            };
            return new ActivityTypeStatistics(label, total, correct, total == 0 ? null : Percent(correct, total));
        }).ToArray();

    private static IReadOnlyList<ErrorConceptStatistics> ErrorConcepts(List<ConceptTypeRow> rows, int minAttempts, ActivityType? filterType) =>
        rows.Where(row => ScoredTypes.Contains(row.Type) && (filterType is null || row.Type == filterType))
            .GroupBy(row => new { row.ConceptId, row.Name })
            .Select(group => new { group.Key.ConceptId, group.Key.Name, Attempts = group.Sum(row => row.Total), Errors = group.Sum(row => row.Total - row.Correct) })
            .Where(item => item.Attempts >= minAttempts)
            .OrderByDescending(item => item.Errors / (double)item.Attempts).ThenByDescending(item => item.Attempts)
            .Take(5).Select(item => new ErrorConceptStatistics(item.ConceptId, item.Name, item.Attempts,
                Percent(item.Errors, item.Attempts))).ToArray();

    private static ConceptDistributionStatistics Distribution(IReadOnlyList<StudentInfo> students, IReadOnlyList<ConceptInfo> concepts,
        Dictionary<(Guid StudentId, Guid ConceptId), LearningState> states)
    {
        var mastered = 0;
        var learning = 0;
        var notStarted = 0;
        foreach (var student in students)
            foreach (var concept in concepts)
            {
                var state = states.GetValueOrDefault((student.Id, concept.Id), LearningState.New);
                if (state == LearningState.Mastered) mastered++;
                else if (state is LearningState.Exposure or LearningState.Recognition or LearningState.GuidedRecall or LearningState.FreeRecall) learning++;
                else notStarted++;
            }
        return new ConceptDistributionStatistics(mastered, learning, notStarted);
    }

    private static IReadOnlyList<StudentProgressBandStatistics> ProgressBands(IReadOnlyList<StudentInfo> students,
        IReadOnlyList<ConceptInfo> concepts, Dictionary<(Guid StudentId, Guid ConceptId), LearningState> states)
    {
        var bands = new[] { 0, 0, 0, 0 };
        foreach (var student in students)
        {
            var progress = Percent(concepts.Count(concept => states.GetValueOrDefault((student.Id, concept.Id)) == LearningState.Mastered), concepts.Count);
            bands[progress <= 25 ? 0 : progress <= 50 ? 1 : progress <= 75 ? 2 : 3]++;
        }
        return new[] { "0–25%", "26–50%", "51–75%", "76–100%" }.Select((range, index) =>
            new StudentProgressBandStatistics(range, bands[index])).ToArray();
    }

    private static int Percent(int value, int total) => total == 0 ? 0 : (int)Math.Round((double)value * 100 / total, MidpointRounding.AwayFromZero);

    private DateRange ParseRange(int days, string? from, string? to)
    {
        var today = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);
        if ((from is null) != (to is null)) throw InvalidFilter("Informe as duas datas, De e Até.");
        if (from is not null && to is not null)
        {
            if (!DateOnly.TryParseExact(from, "yyyy-MM-dd", out var start) || !DateOnly.TryParseExact(to, "yyyy-MM-dd", out var requestedEnd))
                throw InvalidFilter("As datas devem usar o formato AAAA-MM-DD.");
            var end = requestedEnd > today ? today : requestedEnd;
            if (start > end) throw InvalidFilter("A data inicial deve ser anterior ou igual à final.");
            if (end.DayNumber - start.DayNumber + 1 > 180) throw InvalidFilter("O intervalo não pode ultrapassar 180 dias.");
            return new DateRange(start, end);
        }
        if (days is not (7 or 30 or 90 or 180)) throw InvalidFilter("O período deve ser 7, 30, 90 ou 180 dias.");
        return new DateRange(today.AddDays(-(days - 1)), today);
    }

    private static ActivityType? ParseActivityType(string? value)
    {
        if (value is null) return null;
        if (Enum.TryParse<ActivityType>(value, true, out var parsed) && ScoredTypes.Contains(parsed)) return parsed;
        throw InvalidFilter("O tipo de atividade deve ser TRUE_FALSE, FILL_BLANK, GUESS_CONCEPT ou ORDERING.");
    }

    private static ApiException InvalidFilter(string message) => new(400, "invalid_statistics_filter", message);
    private static ApiException NotFound(string message) => new(404, "statistics_scope_not_found", message);
    private static ApiException ModuleNotLinked() => NotFound("O módulo não está publicado e associado a esta turma.");
    private sealed record ClassroomInfo(Guid Id, string Name);
    private sealed record StudentInfo(Guid Id);
    private sealed record ConceptInfo(Guid Id, string Name);
    private sealed record DailyRow(DateOnly Date, ActivityType Type, int Total, int Correct);
    private sealed record ConceptTypeRow(Guid ConceptId, string Name, ActivityType Type, int Total, int Correct);
    private sealed record DateRange(DateOnly Start, DateOnly End);
    private sealed record ClassroomData(Guid ClassroomId, string ClassroomName, Guid[] ModuleIds, List<StudentInfo> Students, List<ConceptInfo> Concepts);
}
