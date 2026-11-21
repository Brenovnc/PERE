using StudyPlatform.Api.Models.Activities;

namespace StudyPlatform.Api.Models;

/// <summary>Student account. Not tied to a classroom: classroom access comes from approved enrollments.</summary>
public sealed class Student
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EmailNormalized { get; private set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTime? LastAccessAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public ICollection<Enrollment> Enrollments { get; set; } = new List<Enrollment>();
    public ICollection<StudentConceptState> ConceptStates { get; set; } = new List<StudentConceptState>();
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
    public ICollection<ActivityAttempt> ActivityAttempts { get; set; } = new List<ActivityAttempt>();
}
