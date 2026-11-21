using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Models;
using StudyPlatform.Api.Services.Modules;

namespace StudyPlatform.Api.Services.Learning;

/// <summary>
/// In-memory cache of a module's active study content: active concepts with their active keywords,
/// clues and activities, plus prerequisite links. The content only changes when a teacher edits the
/// module, so caching it avoids re-reading the whole module on every student answer.
/// </summary>
/// <remarks>
/// Entities are loaded without tracking and shared between requests, so callers must treat them as read-only.
/// ModuleService invalidates the entry whenever it changes a module; the TTL bounds any missed invalidation.
/// </remarks>
public sealed class ModuleContentCache(ApplicationDbContext db, IMemoryCache cache)
{
    private static readonly TimeSpan TimeToLive = TimeSpan.FromMinutes(5);

    public async Task<IReadOnlyList<Concept>> GetActiveConceptsAsync(Guid moduleId, CancellationToken ct)
    {
        if (cache.TryGetValue(Key(moduleId), out IReadOnlyList<Concept>? cached) && cached is not null)
            return cached;

        var concepts = await db.Concepts.AsNoTracking()
            .Where(c => c.ModuleId == moduleId && c.IsActive)
            .Include(c => c.Prerequisites)
            .Include(c => c.Keywords.Where(k => k.IsActive))
            .Include(c => c.Clues.Where(cl => cl.IsActive))
            .Include(c => c.RecognitionActivities.Where(a => a.IsActive))
            .Include(c => c.FillBlankActivities.Where(a => a.IsActive)).ThenInclude(a => a.Answers)
            .Include(c => c.FillBlankActivities.Where(a => a.IsActive)).ThenInclude(a => a.Distractors)
            .Include(c => c.OrderingActivities.Where(a => a.IsActive)).ThenInclude(a => a.Items)
            .AsSplitQuery()
            .OrderBy(c => c.Id)
            .ToListAsync(ct);

        cache.Set(Key(moduleId), (IReadOnlyList<Concept>)concepts, TimeToLive);
        return concepts;
    }

    /// <summary>Also drops the public copy served to visitors when the module is a community listing.</summary>
    public void Invalidate(Guid moduleId)
    {
        cache.Remove(Key(moduleId));
        cache.Remove(PublicCommunityService.DocumentKey(moduleId));
    }

    private static string Key(Guid moduleId) => $"module-content:{moduleId}";
}
