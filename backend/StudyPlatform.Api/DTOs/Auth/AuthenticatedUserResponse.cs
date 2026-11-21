using System.Security.Claims;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.DTOs.Auth;

public sealed record AuthenticatedUserResponse(Guid Id, string Role, string Name, string Email)
{
    public static AuthenticatedUserResponse FromTeacher(Teacher teacher) =>
        new(teacher.Id, AuthRoles.Teacher, teacher.Name, teacher.Email);

    public static AuthenticatedUserResponse FromStudent(Student student) =>
        new(student.Id, AuthRoles.Student, student.Name, student.Email);

    // Built only from the cookie claims: no database query per request.
    public static AuthenticatedUserResponse FromPrincipal(ClaimsPrincipal principal) => new(
        Guid.Parse(principal.FindFirstValue(ClaimTypes.NameIdentifier)!),
        principal.FindFirstValue(ClaimTypes.Role)!,
        principal.FindFirstValue(ClaimTypes.Name) ?? string.Empty,
        principal.FindFirstValue(ClaimTypes.Email) ?? string.Empty);
}

public static class AuthRoles
{
    public const string Teacher = "TEACHER";
    public const string Student = "STUDENT";
}

public static class AuthPolicies
{
    public const string Authenticated = "Authenticated";
    public const string Teacher = "Teacher";
    public const string Student = "Student";
}

public static class RateLimitPolicies
{
    /// <summary>Login, registration and joining a classroom.</summary>
    public const string Sensitive = "Sensitive";
}
