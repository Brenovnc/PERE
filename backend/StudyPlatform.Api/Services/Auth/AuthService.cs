using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.Services.Auth;

public sealed class AuthService(
    ApplicationDbContext dbContext,
    IPasswordHasher<Teacher> teacherPasswordHasher,
    IPasswordHasher<Student> studentPasswordHasher,
    TimeProvider timeProvider)
{
    public async Task<Teacher> RegisterTeacherAsync(TeacherRegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        if (await dbContext.Teachers.AnyAsync(teacher => teacher.EmailNormalized == email.ToLowerInvariant(), cancellationToken))
            throw EmailConflict();

        var teacher = new Teacher { Name = request.Name.Trim(), Email = email };
        teacher.PasswordHash = teacherPasswordHasher.HashPassword(teacher, request.Password);
        dbContext.Teachers.Add(teacher);
        await SaveNewAccountAsync("IX_Teachers_EmailNormalized", cancellationToken);
        return teacher;
    }

    public async Task<Teacher> AuthenticateTeacherAsync(TeacherLoginRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var teacher = await dbContext.Teachers.SingleOrDefaultAsync(
            candidate => candidate.EmailNormalized == normalizedEmail, cancellationToken);

        if (teacher is null || teacherPasswordHasher.VerifyHashedPassword(
                teacher, teacher.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            throw InvalidCredentials();

        return teacher;
    }

    public async Task<Student> RegisterStudentAsync(StudentRegisterRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        if (await dbContext.Students.AnyAsync(student => student.EmailNormalized == email.ToLowerInvariant(), cancellationToken))
            throw EmailConflict();

        var now = timeProvider.GetUtcNow().UtcDateTime;
        var student = new Student
        {
            Name = request.Name.Trim(),
            Email = email,
            LastAccessAtUtc = now,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        };
        student.PasswordHash = studentPasswordHasher.HashPassword(student, request.Password);
        dbContext.Students.Add(student);
        await SaveNewAccountAsync("IX_Students_EmailNormalized", cancellationToken);
        return student;
    }

    public async Task<Student> AuthenticateStudentAsync(StudentLoginRequest request, CancellationToken cancellationToken)
    {
        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var student = await dbContext.Students.SingleOrDefaultAsync(
            candidate => candidate.EmailNormalized == normalizedEmail, cancellationToken);

        if (student is null || !student.IsActive || studentPasswordHasher.VerifyHashedPassword(
                student, student.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            throw InvalidCredentials();

        student.LastAccessAtUtc = timeProvider.GetUtcNow().UtcDateTime;
        await dbContext.SaveChangesAsync(cancellationToken);
        return student;
    }

    // The unique index is the final guard against two simultaneous registrations with the same e-mail.
    private async Task SaveNewAccountAsync(string emailIndexName, CancellationToken cancellationToken)
    {
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
        } postgres && postgres.ConstraintName == emailIndexName)
        {
            throw EmailConflict();
        }
    }

    private static ApiException EmailConflict() => new(
        StatusCodes.Status409Conflict, "email_already_registered", "Já existe uma conta com este e-mail.");

    private static ApiException InvalidCredentials() => new(
        StatusCodes.Status401Unauthorized, "invalid_credentials", "Credenciais inválidas.");
}
