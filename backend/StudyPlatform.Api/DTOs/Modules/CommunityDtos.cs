namespace StudyPlatform.Api.DTOs.Modules;

public sealed record ShareCommunityModuleRequest(Guid ModuleId);

public sealed record CommunityMineResponse(
    Guid Id,
    string Title,
    string? Description,
    string Subject,
    int ActiveConceptCount,
    DateTime? SharedAtUtc,
    int DownloadCount,
    bool CrosswordEnabled,
    Guid? CommunitySourceModuleId);

public sealed record CommunityItemResponse(
    Guid Id,
    string Title,
    string? Description,
    string Subject,
    int ActiveConceptCount,
    string AuthorName,
    string? AuthorInstitution,
    DateTime? SharedAtUtc,
    int DownloadCount,
    bool CrosswordEnabled,
    bool AlreadyDownloaded);

public sealed record CommunitySearchResponse(IReadOnlyList<CommunityItemResponse> Items, int Total, int Page, int PageSize);

/// <summary>A community module as visitors see it (no download count or per-teacher data).</summary>
public sealed record PublicCommunityItemResponse(
    Guid Id,
    string Title,
    string? Description,
    string Subject,
    int ActiveConceptCount,
    string AuthorName,
    string? AuthorInstitution,
    DateTime? SharedAtUtc,
    bool CrosswordEnabled);

public sealed record PublicCommunityPageResponse(IReadOnlyList<PublicCommunityItemResponse> Items, int Total, int Page, int PageSize);
