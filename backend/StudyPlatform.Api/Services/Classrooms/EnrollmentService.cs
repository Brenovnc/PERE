using Microsoft.EntityFrameworkCore;
using Npgsql;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Domain.Enums;
using StudyPlatform.Api.DTOs.Classrooms;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.Services.Classrooms;

/// <summary>Students join classrooms by code; the teacher approves, rejects or removes them.</summary>
public sealed class EnrollmentService(ApplicationDbContext db, TimeProvider timeProvider)
{
    public async Task<StudentClassroomResponse> JoinAsync(Guid studentId, string code, CancellationToken ct)
    {
        var normalizedCode = code.Trim().ToLowerInvariant();
        var classroom = await db.Classrooms.AsNoTracking()
            .Where(x => x.CodeNormalized == normalizedCode && x.Status == ClassroomStatus.Active)
            .Select(x => new { x.Id, x.Name, TeacherName = x.Teacher.Name })
            .SingleOrDefaultAsync(ct)
            ?? throw new ApiException(404, "invalid_classroom_code", "Código de turma inválido.");

        var now = Now;
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(x => x.StudentId == studentId && x.ClassroomId == classroom.Id, ct);
        if (enrollment is null)
        {
            enrollment = new Enrollment { StudentId = studentId, ClassroomId = classroom.Id, RequestedAtUtc = now };
            db.Enrollments.Add(enrollment);
        }
        else if (enrollment.Status == EnrollmentStatus.Approved)
        {
            throw new ApiException(409, "already_enrolled", "Você já participa desta turma.");
        }
        else if (enrollment.Status == EnrollmentStatus.Rejected)
        {
            // A rejected student may ask again; the teacher decides once more.
            enrollment.Status = EnrollmentStatus.Pending;
            enrollment.RequestedAtUtc = now;
            enrollment.DecidedAtUtc = null;
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new ApiException(409, "enrollment_already_requested", "A solicitação para esta turma já foi enviada.");
        }

        return new StudentClassroomResponse(classroom.Id, classroom.Name, classroom.TeacherName,
            StatusName(enrollment.Status), enrollment.RequestedAtUtc, enrollment.DecidedAtUtc);
    }

    public async Task<IReadOnlyList<StudentClassroomResponse>> ListForStudentAsync(Guid studentId, CancellationToken ct)
    {
        var rows = await db.Enrollments.AsNoTracking()
            .Where(x => x.StudentId == studentId && x.Classroom.Status == ClassroomStatus.Active)
            .OrderBy(x => x.Classroom.Name)
            .Select(x => new { x.ClassroomId, x.Classroom.Name, TeacherName = x.Classroom.Teacher.Name, x.Status, x.RequestedAtUtc, x.DecidedAtUtc })
            .ToListAsync(ct);
        return rows.Select(x => new StudentClassroomResponse(x.ClassroomId, x.Name, x.TeacherName,
            StatusName(x.Status), x.RequestedAtUtc, x.DecidedAtUtc)).ToList();
    }

    public async Task<IReadOnlyList<EnrollmentResponse>> ListForTeacherAsync(Guid teacherId, Guid classroomId, string? status, CancellationToken ct)
    {
        await EnsureOwnedAsync(teacherId, classroomId, ct);
        var query = db.Enrollments.AsNoTracking().Where(x => x.ClassroomId == classroomId);
        if (status is not null)
        {
            if (!Enum.TryParse<EnrollmentStatus>(status, ignoreCase: true, out var parsed))
                throw new ApiException(400, "invalid_enrollment_status", "O status deve ser PENDING, APPROVED ou REJECTED.");
            query = query.Where(x => x.Status == parsed);
        }

        var rows = await query
            .OrderBy(x => x.Status).ThenBy(x => x.Student.Name)
            .Select(x => new { x.StudentId, x.Student.Name, x.Student.Email, x.Status, x.RequestedAtUtc, x.DecidedAtUtc, x.Student.LastAccessAtUtc })
            .ToListAsync(ct);
        return rows.Select(x => new EnrollmentResponse(x.StudentId, x.Name, x.Email, StatusName(x.Status),
            x.RequestedAtUtc, x.DecidedAtUtc, x.LastAccessAtUtc)).ToList();
    }

    public Task ApproveAsync(Guid teacherId, Guid classroomId, Guid studentId, CancellationToken ct) =>
        DecideAsync(teacherId, classroomId, studentId, EnrollmentStatus.Approved, ct);

    public Task RejectAsync(Guid teacherId, Guid classroomId, Guid studentId, CancellationToken ct) =>
        DecideAsync(teacherId, classroomId, studentId, EnrollmentStatus.Rejected, ct);

    public async Task<ApproveAllResponse> ApproveAllPendingAsync(Guid teacherId, Guid classroomId, CancellationToken ct)
    {
        await EnsureOwnedAsync(teacherId, classroomId, ct);
        var now = Now;
        var approved = await db.Enrollments
            .Where(x => x.ClassroomId == classroomId && x.Status == EnrollmentStatus.Pending)
            .ExecuteUpdateAsync(update => update
                .SetProperty(x => x.Status, EnrollmentStatus.Approved)
                .SetProperty(x => x.DecidedAtUtc, (DateTime?)now), ct);
        return new ApproveAllResponse(approved);
    }

    /// <summary>Removes the student from the classroom. Their learning progress is kept (it belongs to the student).</summary>
    public async Task RemoveAsync(Guid teacherId, Guid classroomId, Guid studentId, CancellationToken ct)
    {
        await EnsureOwnedAsync(teacherId, classroomId, ct);
        var deleted = await db.Enrollments
            .Where(x => x.ClassroomId == classroomId && x.StudentId == studentId)
            .ExecuteDeleteAsync(ct);
        if (deleted == 0) throw EnrollmentNotFound();
    }

    private async Task DecideAsync(Guid teacherId, Guid classroomId, Guid studentId, EnrollmentStatus status, CancellationToken ct)
    {
        await EnsureOwnedAsync(teacherId, classroomId, ct);
        var enrollment = await db.Enrollments.SingleOrDefaultAsync(x => x.ClassroomId == classroomId && x.StudentId == studentId, ct)
            ?? throw EnrollmentNotFound();
        enrollment.Status = status;
        enrollment.DecidedAtUtc = Now;
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureOwnedAsync(Guid teacherId, Guid classroomId, CancellationToken ct)
    {
        if (!await db.Classrooms.AnyAsync(x => x.Id == classroomId && x.TeacherId == teacherId, ct))
            throw new ApiException(404, "classroom_not_found", "A turma não foi encontrada.");
    }

    private static string StatusName(EnrollmentStatus status) => status.ToString().ToUpperInvariant();
    private static ApiException EnrollmentNotFound() => new(404, "enrollment_not_found", "O aluno não foi encontrado nesta turma.");
    private DateTime Now => timeProvider.GetUtcNow().UtcDateTime;
}
