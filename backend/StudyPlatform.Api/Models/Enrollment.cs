using StudyPlatform.Api.Domain.Enums;

namespace StudyPlatform.Api.Models;

/// <summary>A student's request to join a classroom; only approved enrollments grant access to its modules.</summary>
public sealed class Enrollment
{
    public Guid StudentId { get; set; }
    public Guid ClassroomId { get; set; }
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Pending;
    public DateTime RequestedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? DecidedAtUtc { get; set; }

    public Student Student { get; set; } = null!;
    public Classroom Classroom { get; set; } = null!;
}
