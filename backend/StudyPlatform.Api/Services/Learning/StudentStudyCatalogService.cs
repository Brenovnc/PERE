using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Domain.Enums;
using StudyPlatform.Api.DTOs.Learning;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.Services.Learning;

public sealed class StudentStudyCatalogService(ApplicationDbContext db, TimeProvider? timeProvider = null)
{
    public async Task<IReadOnlyList<StudentModuleResponse>> ListModulesAsync(Guid studentId, CancellationToken ct)
    {
        var modules = await ToModuleRows(AccessibleModules(studentId).OrderBy(module => module.Title)).ToListAsync(ct);
        return await BuildResponsesAsync(studentId, modules, ct);
    }

    public async Task<StudentModuleResponse> GetModuleAsync(Guid studentId, Guid moduleId, CancellationToken ct)
    {
        var module = await ToModuleRows(AccessibleModules(studentId).Where(module => module.Id == moduleId)).SingleOrDefaultAsync(ct)
            ?? throw new ApiException(404, "student_module_not_found", "O módulo não foi encontrado.");
        return (await BuildResponsesAsync(studentId, [module], ct))[0];
    }

    // Union of the published modules of every active classroom where the student's enrollment is approved.
    // Querying modules (not classroom links) keeps a module linked to two classrooms from appearing twice.
    private IQueryable<Module> AccessibleModules(Guid studentId) =>
        db.Modules.AsNoTracking()
            .Where(module => !module.IsCommunityListing && module.Status == ModuleStatus.Published
                && module.ClassroomModules.Any(link => link.Classroom.Status == ClassroomStatus.Active
                    && link.Classroom.Enrollments.Any(e => e.StudentId == studentId
                        && e.Status == EnrollmentStatus.Approved
                        && e.Student.IsActive)));

    private static IQueryable<ModuleRow> ToModuleRows(IQueryable<Module> modules) =>
        modules.Select(module => new ModuleRow(
            module.Id,
            module.Title,
            module.Description,
            module.Subject,
            module.CrosswordEnabled,
            module.CrosswordAllowAllWords,
            module.Teacher.Name,
            module.Teacher.Institution));

    // Loads concepts, states and active sessions for all modules at once (three queries regardless of module count).
    private async Task<List<StudentModuleResponse>> BuildResponsesAsync(Guid studentId, IReadOnlyList<ModuleRow> modules, CancellationToken ct)
    {
        if (modules.Count == 0) return [];
        var moduleIds = modules.Select(module => module.Id).ToArray();

        var concepts = await db.Concepts.AsNoTracking()
            .Where(concept => moduleIds.Contains(concept.ModuleId) && concept.IsActive)
            .OrderBy(concept => concept.Name)
            .Select(concept => new { concept.ModuleId, concept.Id, concept.Name })
            .ToListAsync(ct);
        var conceptIds = concepts.Select(concept => concept.Id).ToArray();
        var states = conceptIds.Length == 0 ? [] : await db.StudentConceptStates.AsNoTracking()
            .Where(state => state.StudentId == studentId && conceptIds.Contains(state.ConceptId))
            .Select(state => new { state.ConceptId, state.LearningState, state.DueAtUtc })
            .ToListAsync(ct);
        var activeSessions = await db.StudySessions.AsNoTracking()
            .Where(session => session.StudentId == studentId && moduleIds.Contains(session.ModuleId) && session.Status == StudySessionStatus.Active)
            .Select(session => new { session.ModuleId, session.Id, session.Mode })
            .ToListAsync(ct);

        var conceptsByModule = concepts.ToLookup(concept => concept.ModuleId);
        var moduleByConcept = concepts.ToDictionary(concept => concept.Id, concept => concept.ModuleId);
        var statesByModule = states.ToLookup(state => moduleByConcept[state.ConceptId]);
        var now = (timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime;

        return modules.Select(module =>
        {
            var moduleConcepts = conceptsByModule[module.Id]
                .Select(concept => new StudentModuleConceptOption(concept.Id, concept.Name)).ToList();
            var moduleStates = statesByModule[module.Id].ToList();
            var activeConceptCount = moduleConcepts.Count;
            var mastered = moduleStates.Count(state => state.LearningState == LearningState.Mastered);
            var learning = moduleStates.Count(state => state.LearningState is LearningState.Exposure or LearningState.Recognition or LearningState.GuidedRecall or LearningState.FreeRecall);
            var notStarted = activeConceptCount - mastered - learning;
            var pending = moduleStates.Count(state => state.LearningState != LearningState.New && state.DueAtUtc is not null && state.DueAtUtc <= now);
            var nextReview = moduleStates.Where(state => state.LearningState != LearningState.New && state.DueAtUtc > now)
                .Select(state => state.DueAtUtc).Min();
            var activeSession = activeSessions.FirstOrDefault(session => session.ModuleId == module.Id);
            var progress = activeConceptCount == 0 ? 0 : (int)Math.Round((double)mastered * 100 / activeConceptCount, MidpointRounding.AwayFromZero);
            var mode = activeSession is null ? null : activeSession.Mode == StudySessionMode.FreePractice ? "FREE_PRACTICE" : "NORMAL";
            return new StudentModuleResponse(module.Id, module.Title, module.Description, module.Subject, activeSession?.Id,
                activeConceptCount, mastered, learning, notStarted, pending, progress, nextReview, mode, moduleConcepts,
                module.CrosswordEnabled, module.CrosswordEnabled && module.CrosswordAllowAllWords,
                module.TeacherName, module.TeacherInstitution);
        }).ToList();
    }

    private sealed record ModuleRow(Guid Id, string Title, string? Description, string Subject,
        bool CrosswordEnabled, bool CrosswordAllowAllWords, string TeacherName, string? TeacherInstitution);
}
