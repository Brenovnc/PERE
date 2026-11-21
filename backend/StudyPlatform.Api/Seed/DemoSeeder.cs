using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.DTOs.Classrooms;
using StudyPlatform.Api.Services.Auth;
using StudyPlatform.Api.Services.Classrooms;
using StudyPlatform.Api.Services.Modules;

namespace StudyPlatform.Api.Seed;

/// <summary>
/// Demonstration data, created only when PERE_SEED_DEMO=true: a teacher, a classroom with a known code,
/// an approved student and the "Fundamentos de redes" module (published and shared with the community).
/// It goes through the same services as the API, so passwords are hashed and the module passes the
/// publication checks. Runs once: nothing happens if the demo teacher already exists.
/// </summary>
public sealed class DemoSeeder(
    ApplicationDbContext db,
    AuthService auth,
    ModuleTransferService transfer,
    ModuleService modules,
    ClassroomService classrooms,
    EnrollmentService enrollments,
    ILogger<DemoSeeder> logger)
{
    // Demonstration only: these credentials are public in the README.
    public const string TeacherEmail = "professor@pere.demo";
    public const string StudentEmail = "aluno@pere.demo";
    public const string Password = "demo1234";
    public const string ClassroomCode = "DEMO-PERE";

    public async Task SeedAsync(CancellationToken ct)
    {
        if (await db.Teachers.AnyAsync(t => t.EmailNormalized == TeacherEmail, ct))
        {
            logger.LogInformation("Demo data already exists; seed skipped.");
            return;
        }

        var teacher = await auth.RegisterTeacherAsync(new TeacherRegisterRequest
        {
            Name = "Professora Demo",
            Email = TeacherEmail,
            Password = Password,
            ConfirmPassword = Password,
        }, ct);

        var module = await transfer.ImportAsync(teacher.Id, await ReadDemoModuleAsync(ct), ct);
        await modules.PublishAsync(teacher.Id, module.Id, ct);
        await modules.ShareToCommunityAsync(teacher.Id, module.Id, ct);

        var classroom = await classrooms.CreateAsync(teacher.Id,
            new CreateClassroomRequest { Name = "Turma de demonstração", Code = ClassroomCode }, ct);
        await classrooms.AssignModuleAsync(teacher.Id, classroom.Id, module.Id, ct);

        var student = await auth.RegisterStudentAsync(new StudentRegisterRequest
        {
            Name = "Aluno Demo",
            Email = StudentEmail,
            Password = Password,
            ConfirmPassword = Password,
        }, ct);
        await enrollments.JoinAsync(student.Id, ClassroomCode, ct);
        await enrollments.ApproveAsync(teacher.Id, classroom.Id, student.Id, ct);

        logger.LogWarning("Demo data created (demonstration only): {Teacher} and {Student}, classroom {Code}.",
            TeacherEmail, StudentEmail, ClassroomCode);
    }

    private static async Task<string> ReadDemoModuleAsync(CancellationToken ct)
    {
        await using var stream = typeof(DemoSeeder).Assembly.GetManifestResourceStream("StudyPlatform.Api.Seed.demo-module.json")
            ?? throw new InvalidOperationException("The demo module resource is missing.");
        using var reader = new StreamReader(stream);
        return await reader.ReadToEndAsync(ct);
    }
}
