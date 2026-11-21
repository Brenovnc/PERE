using System.Security.Claims;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.Services.Auth;

namespace StudyPlatform.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(
    AuthService authService,
    IAntiforgery antiforgery,
    TimeProvider timeProvider) : ControllerBase
{
    [HttpGet("csrf")]
    [AllowAnonymous]
    public IActionResult GetCsrfToken()
    {
        Response.Headers.CacheControl = "no-store";
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        return Ok(new CsrfTokenResponse(tokens.RequestToken!));
    }

    [HttpPost("teachers/register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Sensitive)]
    public async Task<ActionResult<AuthenticatedUserResponse>> RegisterTeacher(TeacherRegisterRequest request, CancellationToken ct)
    {
        var teacher = await authService.RegisterTeacherAsync(request, ct);
        await SignInAsync(AuthPrincipalFactory.ForTeacher(teacher));
        return StatusCode(StatusCodes.Status201Created, AuthenticatedUserResponse.FromTeacher(teacher));
    }

    [HttpPost("teachers/login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Sensitive)]
    public async Task<ActionResult<AuthenticatedUserResponse>> LoginTeacher(TeacherLoginRequest request, CancellationToken ct)
    {
        var teacher = await authService.AuthenticateTeacherAsync(request, ct);
        await SignInAsync(AuthPrincipalFactory.ForTeacher(teacher));
        return Ok(AuthenticatedUserResponse.FromTeacher(teacher));
    }

    [HttpPost("students/register")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Sensitive)]
    public async Task<ActionResult<AuthenticatedUserResponse>> RegisterStudent(StudentRegisterRequest request, CancellationToken ct)
    {
        var student = await authService.RegisterStudentAsync(request, ct);
        await SignInAsync(AuthPrincipalFactory.ForStudent(student));
        return StatusCode(StatusCodes.Status201Created, AuthenticatedUserResponse.FromStudent(student));
    }

    [HttpPost("students/login")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.Sensitive)]
    public async Task<ActionResult<AuthenticatedUserResponse>> LoginStudent(StudentLoginRequest request, CancellationToken ct)
    {
        var student = await authService.AuthenticateStudentAsync(request, ct);
        await SignInAsync(AuthPrincipalFactory.ForStudent(student));
        return Ok(AuthenticatedUserResponse.FromStudent(student));
    }

    [HttpPost("logout")]
    [Authorize(Policy = AuthPolicies.Authenticated)]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(new { message = "Sessão encerrada." });
    }

    [HttpGet("me")]
    [Authorize(Policy = AuthPolicies.Authenticated)]
    public ActionResult<AuthenticatedUserResponse> Me() =>
        Ok(AuthenticatedUserResponse.FromPrincipal(User));

    private Task SignInAsync(ClaimsPrincipal principal) =>
        HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = timeProvider.GetUtcNow().AddHours(8),
                AllowRefresh = false,
            });
}
