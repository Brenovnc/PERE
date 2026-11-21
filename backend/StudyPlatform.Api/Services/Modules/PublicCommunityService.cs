using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.DTOs.Modules;

namespace StudyPlatform.Api.Services.Modules;

/// <summary>JSON ready to send, with the ETag computed from its bytes.</summary>
public sealed record CachedJson(byte[] Content, string ETag);

/// <summary>
/// Read-only community data for visitor mode (no login). Responses are serialized once and kept in
/// memory, so repeated requests and ETag revalidations do not reach the database.
/// </summary>
public sealed class PublicCommunityService(ApplicationDbContext db, ModuleTransferService transfer, IMemoryCache cache)
{
    public const int MaxPageSize = 48;
    // The list changes whenever any teacher shares or deletes a module; a short TTL keeps it fresh enough.
    private static readonly TimeSpan ListTimeToLive = TimeSpan.FromMinutes(1);
    // A module document is removed from the cache when the listing changes (see ModuleContentCache.Invalidate).
    private static readonly TimeSpan DocumentTimeToLive = TimeSpan.FromMinutes(10);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public static string DocumentKey(Guid moduleId) => $"public-community-module:{moduleId}";

    public async Task<CachedJson> ListAsync(string? search, string? subject, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);
        var term = search?.Trim().ToLower() ?? "";
        var subjectFilter = subject?.Trim() ?? "";
        var key = $"public-community-list:{page}:{pageSize}:{term}:{subjectFilter}";
        if (cache.TryGetValue(key, out CachedJson? cached) && cached is not null) return cached;

        var query = db.Modules.AsNoTracking().Where(x => x.IsCommunityListing);
        if (term.Length > 0)
            query = query.Where(x => x.Title.ToLower().Contains(term)
                || (x.Description ?? "").ToLower().Contains(term)
                || x.Subject.ToLower().Contains(term)
                || x.Teacher.Name.ToLower().Contains(term));
        if (subjectFilter.Length > 0)
            query = query.Where(x => x.Subject == subjectFilter);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderByDescending(x => x.SharedAtUtc)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new PublicCommunityItemResponse(
                x.Id,
                x.Title,
                x.Description,
                x.Subject,
                x.Concepts.Count(c => c.IsActive),
                x.Teacher.Name,
                x.Teacher.Institution,
                x.SharedAtUtc,
                x.CrosswordEnabled))
            .ToListAsync(ct);

        var json = Create(JsonSerializer.SerializeToUtf8Bytes(new PublicCommunityPageResponse(items, total, page, pageSize), JsonOptions));
        cache.Set(key, json, ListTimeToLive);
        return json;
    }

    /// <summary>The module in the import/export format (schemaVersion 1), or null if it is not a community listing.</summary>
    public async Task<CachedJson?> GetDocumentAsync(Guid moduleId, CancellationToken ct)
    {
        if (cache.TryGetValue(DocumentKey(moduleId), out CachedJson? cached) && cached is not null) return cached;
        var content = await transfer.ExportCommunityListingAsync(moduleId, ct);
        if (content is null) return null;
        var json = Create(content);
        cache.Set(DocumentKey(moduleId), json, DocumentTimeToLive);
        return json;
    }

    private static CachedJson Create(byte[] content) =>
        new(content, $"\"{Convert.ToBase64String(SHA256.HashData(content))}\"");
}
