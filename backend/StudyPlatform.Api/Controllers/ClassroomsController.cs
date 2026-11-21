using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.DTOs.Classrooms;
using StudyPlatform.Api.DTOs.Progress;
using StudyPlatform.Api.Services.Classrooms;
using StudyPlatform.Api.Services.Progress;

namespace StudyPlatform.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.Teacher)]
[Route("api/classrooms")]
public sealed class ClassroomsController(
    ClassroomService classrooms,
    EnrollmentService enrollments,
    TeacherProgressService progress,
    TeacherStatisticsService statistics) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ClassroomSummaryResponse>>> List(CancellationToken ct) =>
        Ok(await classrooms.ListAsync(TeacherId, ct));

    [HttpPost]
    public async Task<ActionResult<ClassroomDetailsResponse>> Create(CreateClassroomRequest request, CancellationToken ct)
    {
        var created = await classrooms.CreateAsync(TeacherId, request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ClassroomDetailsResponse>> Get(Guid id, CancellationToken ct) =>
        Ok(await classrooms.GetAsync(TeacherId, id, ct));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ClassroomDetailsResponse>> Update(Guid id, UpdateClassroomRequest request, CancellationToken ct) =>
        Ok(await classrooms.UpdateAsync(TeacherId, id, request, ct));

    [HttpPost("{id:guid}/regenerate-code")]
    public async Task<ActionResult<ClassroomDetailsResponse>> RegenerateCode(Guid id, CancellationToken ct) =>
        Ok(await classrooms.RegenerateCodeAsync(TeacherId, id, ct));

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, CancellationToken ct)
    {
        await classrooms.ArchiveAsync(TeacherId, id, ct);
        return NoContent();
    }

    [HttpPost("{classroomId:guid}/modules")]
    public async Task<IActionResult> AssignModule(Guid classroomId, AssignModuleRequest request, CancellationToken ct)
    {
        await classrooms.AssignModuleAsync(TeacherId, classroomId, request.ModuleId, ct);
        return NoContent();
    }

    [HttpPost("{classroomId:guid}/modules/{moduleId:guid}")]
    public async Task<IActionResult> AssignModule(Guid classroomId, Guid moduleId, CancellationToken ct)
    {
        await classrooms.AssignModuleAsync(TeacherId, classroomId, moduleId, ct);
        return NoContent();
    }

    [HttpDelete("{classroomId:guid}/modules/{moduleId:guid}")]
    public async Task<IActionResult> UnassignModule(Guid classroomId, Guid moduleId, CancellationToken ct)
    {
        await classrooms.UnassignModuleAsync(TeacherId, classroomId, moduleId, ct);
        return NoContent();
    }

    /// <summary>Lists enrollments; <paramref name="status"/> (PENDING, APPROVED, REJECTED) is optional.</summary>
    [HttpGet("{classroomId:guid}/enrollments")]
    public async Task<ActionResult<IReadOnlyList<EnrollmentResponse>>> ListEnrollments(Guid classroomId, [FromQuery] string? status, CancellationToken ct) =>
        Ok(await enrollments.ListForTeacherAsync(TeacherId, classroomId, status, ct));

    [HttpPost("{classroomId:guid}/enrollments/approve-all")]
    public async Task<ActionResult<ApproveAllResponse>> ApproveAll(Guid classroomId, CancellationToken ct) =>
        Ok(await enrollments.ApproveAllPendingAsync(TeacherId, classroomId, ct));

    [HttpPost("{classroomId:guid}/enrollments/{studentId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid classroomId, Guid studentId, CancellationToken ct)
    {
        await enrollments.ApproveAsync(TeacherId, classroomId, studentId, ct);
        return NoContent();
    }

    [HttpPost("{classroomId:guid}/enrollments/{studentId:guid}/reject")]
    public async Task<IActionResult> Reject(Guid classroomId, Guid studentId, CancellationToken ct)
    {
        await enrollments.RejectAsync(TeacherId, classroomId, studentId, ct);
        return NoContent();
    }

    [HttpDelete("{classroomId:guid}/enrollments/{studentId:guid}")]
    public async Task<IActionResult> Remove(Guid classroomId, Guid studentId, CancellationToken ct)
    {
        await enrollments.RemoveAsync(TeacherId, classroomId, studentId, ct);
        return NoContent();
    }

    [HttpGet("{classroomId:guid}/progress")]
    public async Task<ActionResult<ClassroomProgressResponse>> GetProgress(Guid classroomId, CancellationToken ct) =>
        Ok(await progress.GetClassroomProgressAsync(TeacherId, classroomId, ct));

    [HttpGet("{classroomId:guid}/students/{studentId:guid}/progress")]
    public async Task<ActionResult<StudentProgressResponse>> GetStudentProgress(Guid classroomId, Guid studentId, CancellationToken ct) =>
        Ok(await progress.GetStudentProgressAsync(TeacherId, classroomId, studentId, ct));

    [HttpGet("{classroomId:guid}/statistics")]
    public async Task<ActionResult<ClassroomStatisticsResponse>> GetStatistics(
        Guid classroomId,
        [FromQuery] int days = 30,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] Guid? moduleId = null,
        [FromQuery] string? activityType = null,
        [FromQuery] int minAttempts = 3,
        CancellationToken ct = default) =>
        Ok(await statistics.GetClassroomAsync(TeacherId, classroomId, days, from, to, moduleId, activityType, minAttempts, ct));

    [HttpGet("{classroomId:guid}/students/{studentId:guid}/statistics")]
    public async Task<ActionResult<StudentStatisticsResponse>> GetStudentStatistics(
        Guid classroomId,
        Guid studentId,
        [FromQuery] int days = 30,
        [FromQuery] string? from = null,
        [FromQuery] string? to = null,
        [FromQuery] Guid? moduleId = null,
        [FromQuery] string? activityType = null,
        CancellationToken ct = default) =>
        Ok(await statistics.GetStudentAsync(TeacherId, classroomId, studentId, days, from, to, moduleId, activityType, ct));

    private Guid TeacherId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
