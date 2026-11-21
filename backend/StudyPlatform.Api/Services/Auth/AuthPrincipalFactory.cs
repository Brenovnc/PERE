using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.Services.Auth;

public static class AuthPrincipalFactory
{
    public static ClaimsPrincipal ForTeacher(Teacher teacher) =>
        Create(teacher.Id, teacher.Name, teacher.Email, AuthRoles.Teacher);

    public static ClaimsPrincipal ForStudent(Student student) =>
        Create(student.Id, student.Name, student.Email, AuthRoles.Student);

    private static ClaimsPrincipal Create(Guid id, string name, string email, string role) => new(
        new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, id.ToString()),
                new Claim(ClaimTypes.Name, name),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Role, role),
            ],
            CookieAuthenticationDefaults.AuthenticationScheme,
            ClaimTypes.Name,
            ClaimTypes.Role));
}
