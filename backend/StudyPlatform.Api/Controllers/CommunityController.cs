using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Domain.Enums;
using StudyPlatform.Api.DTOs.Auth;
using StudyPlatform.Api.DTOs.Modules;
using StudyPlatform.Api.Exceptions;
using StudyPlatform.Api.Services.Learning;
using StudyPlatform.Api.Services.Modules;

namespace StudyPlatform.Api.Controllers;

[ApiController]
[Authorize(Policy = AuthPolicies.Teacher)]
[Route("api/community/modules")]
public sealed class CommunityController(ApplicationDbContext db, ModuleService modules, ModuleContentCache contentCache) : ControllerBase
{
    [HttpGet("mine")]
    public async Task<ActionResult<IReadOnlyList<CommunityMineResponse>>> Mine(CancellationToken ct)
    {
        var listings = await db.Modules.AsNoTracking()
            .Where(x => x.TeacherId == TeacherId && x.IsCommunityListing)
            .OrderByDescending(x => x.SharedAtUtc)
            .Select(x => new CommunityMineResponse(
                x.Id,
                x.Title,
                x.Description,
                x.Subject,
                x.Concepts.Count(c => c.IsActive),
                x.SharedAtUtc,
                x.CommunityDownloadCount,
                x.CrosswordEnabled,
                x.CommunitySourceModuleId))
            .ToListAsync(ct);
        return Ok(listings);
    }

    [HttpGet]
    public async Task<ActionResult<CommunitySearchResponse>> Search(
        [FromQuery] string? search,
        [FromQuery] string? subject,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 24,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var query = db.Modules.AsNoTracking().Where(x => x.IsCommunityListing && x.TeacherId != TeacherId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(x => x.Title.ToLower().Contains(term)
                || (x.Description ?? "").ToLower().Contains(term)
                || x.Subject.ToLower().Contains(term)
                || x.Teacher.Name.ToLower().Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(subject))
            query = query.Where(x => x.Subject == subject);

        var total = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(x => x.SharedAtUtc)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new CommunityItemResponse(
                x.Id,
                x.Title,
                x.Description,
                x.Subject,
                x.Concepts.Count(c => c.IsActive),
                x.Teacher.Name,
                x.Teacher.Institution,
                x.SharedAtUtc,
                x.CommunityDownloadCount,
                x.CrosswordEnabled,
                db.Modules.Any(m => m.TeacherId == TeacherId && m.CommunityOriginModuleId == x.Id)))
            .ToListAsync(ct);
        return Ok(new CommunitySearchResponse(rows, total, page, pageSize));
    }

    [HttpPost]
    public async Task<ActionResult<CommunityMineResponse>> Share(ShareCommunityModuleRequest request, CancellationToken ct) =>
        Ok(await modules.ShareToCommunityAsync(TeacherId, request.ModuleId, ct));

    [HttpPost("{id:guid}/download")]
    public async Task<ActionResult<ModuleDetailsResponse>> Download(Guid id, CancellationToken ct)
    {
        var owner = await db.Modules.Where(x => x.Id == id && x.IsCommunityListing)
            .Select(x => x.TeacherId).SingleOrDefaultAsync(ct);
        if (owner == Guid.Empty)
            throw new ApiException(404, "community_module_not_found", "O módulo não foi encontrado.");
        if (owner == TeacherId)
            throw new ApiException(400, "community_own_module", "Não é possível baixar seu próprio envio.");
        return Ok(await modules.DownloadCommunityAsync(TeacherId, id, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var item = await db.Modules.SingleOrDefaultAsync(x => x.Id == id && x.TeacherId == TeacherId && x.IsCommunityListing, ct)
            ?? throw new ApiException(404, "community_module_not_found", "O módulo não foi encontrado.");

        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var concepts = await db.Concepts.Where(c => c.ModuleId == id).Select(c => c.Id).ToArrayAsync(ct);
        var fills = db.FillBlankActivities.Where(a => concepts.Contains(a.ConceptId)).Select(a => a.Id);
        var orders = db.OrderingActivities.Where(a => concepts.Contains(a.ConceptId)).Select(a => a.Id);
        db.ConceptPrerequisites.RemoveRange(db.ConceptPrerequisites.Where(x => x.ModuleId == id));
        db.ConceptKeywords.RemoveRange(db.ConceptKeywords.Where(x => concepts.Contains(x.ConceptId)));
        db.ConceptClues.RemoveRange(db.ConceptClues.Where(x => concepts.Contains(x.ConceptId)));
        db.RecognitionActivities.RemoveRange(db.RecognitionActivities.Where(x => concepts.Contains(x.ConceptId)));
        db.FillBlankAnswers.RemoveRange(db.FillBlankAnswers.Where(x => fills.Contains(x.FillBlankActivityId)));
        db.FillBlankDistractors.RemoveRange(db.FillBlankDistractors.Where(x => fills.Contains(x.FillBlankActivityId)));
        db.FillBlankActivities.RemoveRange(db.FillBlankActivities.Where(x => concepts.Contains(x.ConceptId)));
        db.OrderingActivityItems.RemoveRange(db.OrderingActivityItems.Where(x => orders.Contains(x.OrderingActivityId)));
        db.OrderingActivities.RemoveRange(db.OrderingActivities.Where(x => concepts.Contains(x.ConceptId)));
        db.Concepts.RemoveRange(db.Concepts.Where(x => concepts.Contains(x.Id)));
        db.Modules.Remove(item);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        contentCache.Invalidate(id);
        return NoContent();
    }

    private Guid TeacherId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
}
