using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Services.Modules;

namespace StudyPlatform.Api.Controllers;

/// <summary>Read-only community modules for visitor mode. No login required.</summary>
[ApiController]
[AllowAnonymous]
[Route("api/public/community/modules")]
public sealed class PublicCommunityController(PublicCommunityService community) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? search,
        [FromQuery] string? subject,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken ct = default) =>
        JsonWithETag(await community.ListAsync(search, subject, page, pageSize, ct));

    /// <summary>The module in the import/export format (schemaVersion 1).</summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Get(Guid id, CancellationToken ct) =>
        JsonWithETag(await community.GetDocumentAsync(id, ct)
            ?? throw new ApiException(404, "community_module_not_found", "O módulo não foi encontrado."));

    /// <summary>Answers 304 when the client already has this version; browsers revalidate after a minute.</summary>
    private IActionResult JsonWithETag(CachedJson json)
    {
        Response.Headers.ETag = json.ETag;
        Response.Headers.CacheControl = "public, max-age=60";
        var ifNoneMatch = Request.GetTypedHeaders().IfNoneMatch;
        if (ifNoneMatch.Any(tag => tag.Tag == json.ETag || tag.Tag == "*"))
            return StatusCode(StatusCodes.Status304NotModified);
        return File(json.Content, "application/json; charset=utf-8");
    }
}
