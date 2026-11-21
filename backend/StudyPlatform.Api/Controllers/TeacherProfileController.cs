using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.DTOs.Teachers;
using StudyPlatform.Api.Services.Auth;

namespace StudyPlatform.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.Teacher)]
[Route("api/teacher/profile")]
public sealed class TeacherProfileController(TeacherProfileService profiles, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<TeacherProfileResponse>> Get(CancellationToken ct) =>
        Ok(await profiles.GetAsync(TeacherId, ct));

    [HttpPut]
    public async Task<ActionResult<TeacherProfileResponse>> Update(UpdateTeacherProfileRequest request, CancellationToken ct)
    {
        var teacher = await profiles.UpdateAsync(TeacherId, request, ct);
        // Re-issue the cookie so the name claim reflects the update.
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            AuthPrincipalFactory.ForTeacher(teacher),
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = clock.GetUtcNow().AddHours(8),
                AllowRefresh = false,
            });
        return Ok(await profiles.GetAsync(TeacherId, ct));
    }

    [HttpPut("password")]
    public async Task<IActionResult> Password(ChangeTeacherPasswordRequest request, CancellationToken ct)
    {
        await profiles.ChangePasswordAsync(TeacherId, request, ct);
        return NoContent();
    }

    private Guid TeacherId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
