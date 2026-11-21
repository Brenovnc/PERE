using System.ComponentModel.DataAnnotations;

namespace StudyPlatform.Api.DTOs.Classrooms;

public sealed class JoinClassroomRequest
{
    [Required, StringLength(32, MinimumLength = 3)]
    public string Code { get; init; } = string.Empty;
}

/// <summary>An enrollment as the teacher sees it. Status is PENDING, APPROVED or REJECTED.</summary>
public sealed record EnrollmentResponse(
    Guid StudentId,
    string Name,
    string Email,
    string Status,
    DateTime RequestedAtUtc,
    DateTime? DecidedAtUtc,
    DateTime? LastAccessAtUtc);

/// <summary>A classroom as the student sees it, with the status of their enrollment.</summary>
public sealed record StudentClassroomResponse(
    Guid ClassroomId,
    string Name,
    string TeacherName,
    string Status,
    DateTime RequestedAtUtc,
    DateTime? DecidedAtUtc);

public sealed record ApproveAllResponse(int Approved);
