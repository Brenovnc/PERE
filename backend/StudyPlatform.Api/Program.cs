using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.DTOs.Common;
using StudyPlatform.Api.Middleware;
using StudyPlatform.Api.Models;
using StudyPlatform.Api.Seed;
using StudyPlatform.Api.Services.Auth;
using StudyPlatform.Api.Services.Classrooms;
using StudyPlatform.Api.Services.Learning;
using StudyPlatform.Api.Services.Modules;
using StudyPlatform.Api.Services.Progress;
using StudyPlatform.Api.Validators;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
var dataProtection = builder.Services.AddDataProtection()
    .SetApplicationName("PERE");
if (builder.Environment.IsDevelopment())
{
    dataProtection.UseEphemeralDataProtectionProvider();
}
else
{
    dataProtection.PersistKeysToDbContext<ApplicationDbContext>();
}

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException(
        "Connection string 'DefaultConnection' was not configured.");

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddMemoryCache();
builder.Services.AddScoped<ModuleContentCache>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<ClassroomService>();
builder.Services.AddScoped<EnrollmentService>();
builder.Services.AddScoped<ModuleService>();
builder.Services.AddScoped<ModuleTransferService>();
builder.Services.AddScoped<PublicCommunityService>();
builder.Services.AddScoped<PrerequisiteService>();
builder.Services.AddScoped<FsrsService>();
builder.Services.AddScoped<PerformanceRatingService>();
builder.Services.AddScoped<LearningProgressionService>();
builder.Services.AddScoped<ActivityCompatibilityService>();
builder.Services.AddScoped<ActivitySelectionService>();
builder.Services.AddScoped<StudySessionService>();
builder.Services.AddScoped<StudentStudyCatalogService>();
builder.Services.AddScoped<StudentCrosswordService>();
builder.Services.AddScoped<TeacherProgressService>();
builder.Services.AddScoped<TeacherStatisticsService>();
builder.Services.AddScoped<TeacherProfileService>();
builder.Services.AddScoped<IPasswordHasher<Teacher>, PasswordHasher<Teacher>>();
builder.Services.AddScoped<IPasswordHasher<Student>, PasswordHasher<Student>>();
builder.Services.AddScoped<ApiCookieAuthenticationEvents>();
builder.Services.AddScoped<DemoSeeder>();

// Outside Development cookies require HTTPS. PERE_ALLOW_INSECURE_COOKIES=true lifts that for the
// all-in-one docker-compose, which serves the app over plain http://localhost; never set it in a publication.
var secureCookiePolicy = builder.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("PERE_ALLOW_INSECURE_COOKIES")
    ? CookieSecurePolicy.SameAsRequest
    : CookieSecurePolicy.Always;

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "CAE-XSRF";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = secureCookiePolicy;
});

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "CAE.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = secureCookiePolicy;
        options.Cookie.MaxAge = TimeSpan.FromHours(8);
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = false;
        options.EventsType = typeof(ApiCookieAuthenticationEvents);
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(AuthPolicies.Authenticated, policy => policy.RequireAuthenticatedUser());
    options.AddPolicy(AuthPolicies.Teacher, policy => policy.RequireRole(AuthRoles.Teacher));
    options.AddPolicy(AuthPolicies.Student, policy => policy.RequireRole(AuthRoles.Student));
});

// Login, registration and joining a classroom: 10 attempts per minute, per signed-in user or per IP address.
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(RateLimitPolicies.Sensitive, context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.Connection.RemoteIpAddress?.ToString()
                ?? "unknown",
            _ => new FixedWindowRateLimiterOptions { PermitLimit = 10, Window = TimeSpan.FromMinutes(1) }));
    options.OnRejected = async (context, ct) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(new ApiErrorResponse(
            StatusCodes.Status429TooManyRequests, "too_many_attempts",
            "Muitas tentativas. Aguarde um minuto e tente novamente.", new Dictionary<string, string[]>()), ct);
    };
});

builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        options.InvalidModelStateResponseFactory = context =>
        {
            var response = ModelStateErrorMapper.CreateResponse(context.ModelState);
            return new ObjectResult(response) { StatusCode = response.Status };
        };
    });

const string developmentCorsPolicy = "DevelopmentFrontend";
if (builder.Environment.IsDevelopment())
{
    var frontendOrigin = builder.Configuration["Frontend:Origin"] ?? "http://localhost:4200";
    builder.Services.AddCors(options => options.AddPolicy(developmentCorsPolicy, policy =>
        policy.WithOrigins(frontendOrigin)
            .AllowCredentials()
            .AllowAnyHeader()
            .AllowAnyMethod()));
}

var app = builder.Build();

// Both startup tasks are opt-in: by default the API never changes the database schema or adds data.
var applyMigrations = app.Configuration.GetValue<bool>("PERE_APPLY_MIGRATIONS");
var seedDemo = app.Configuration.GetValue<bool>("PERE_SEED_DEMO");
if (applyMigrations || seedDemo)
{
    await using var scope = app.Services.CreateAsyncScope();
    if (applyMigrations)
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
    if (seedDemo)
        await scope.ServiceProvider.GetRequiredService<DemoSeeder>().SeedAsync(CancellationToken.None);
}

if (!app.Environment.IsDevelopment())
{
    app.UseForwardedHeaders();
}
app.UseMiddleware<ExceptionHandlingMiddleware>();
if (app.Environment.IsDevelopment())
{
    app.UseCors(developmentCorsPolicy);
}
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
app.UseMiddleware<CsrfValidationMiddleware>();

app.MapGet("/health", (IConfiguration configuration) =>
{
    var configuredConnection = configuration.GetConnectionString("DefaultConnection");

    return Results.Ok(new
    {
        status = "healthy",
        databaseConfigured = !string.IsNullOrWhiteSpace(configuredConnection),
    });
});

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapControllers();

app.Run();

public partial class Program { }
