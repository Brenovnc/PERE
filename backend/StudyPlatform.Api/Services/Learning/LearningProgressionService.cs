using Microsoft.EntityFrameworkCore;
using StudyPlatform.Api.Data;
using StudyPlatform.Api.Domain.Enums;
using StudyPlatform.Api.Models;

namespace StudyPlatform.Api.Services.Learning;

/// <summary>
/// Learning-state transitions of a concept. Methods change tracked entities only; the caller saves,
/// so a whole answer is persisted in a single SaveChanges.
/// </summary>
public sealed class LearningProgressionService(
    ApplicationDbContext db,
    FsrsService fsrs,
    PerformanceRatingService performance)
{
    public Task<StudentConceptState?> FindTrackedStateAsync(Guid studentId, Guid conceptId, CancellationToken cancellationToken) =>
        db.StudentConceptStates.SingleOrDefaultAsync(x => x.StudentId == studentId && x.ConceptId == conceptId, cancellationToken);

    /// <summary>
    /// Moves a NEW concept to EXPOSURE when its first activity is shown. Does not check eligibility:
    /// activity selection has already verified the prerequisites.
    /// </summary>
    public StudentConceptState MarkPresented(Guid studentId, Guid conceptId, StudentConceptState? trackedState, DateTime now)
    {
        var state = trackedState;
        if (state is null)
        {
            state = new StudentConceptState { StudentId = studentId, ConceptId = conceptId };
            db.StudentConceptStates.Add(state);
        }
        if (state.LearningState == LearningState.New)
        {
            state.LearningState = LearningState.Exposure;
            state.LastAttemptAtUtc = now;
        }
        return state;
    }

    /// <summary>Applies the EXPOSURE → RECOGNITION transition to a tracked state.</summary>
    public StudentConceptState ApplyExposureCompleted(StudentConceptState? state, DateTime now)
    {
        if (state is null || state.LearningState != LearningState.Exposure)
            throw new InvalidOperationException("Exposure can only be completed from EXPOSURE.");

        state.LearningState = LearningState.Recognition;
        state.LastAttemptAtUtc = now;
        return state;
    }

    /// <summary>
    /// Applies an answer to a tracked state: learning-state transition plus FSRS scheduling.
    /// The caller guarantees that the session belongs to the student and to the concept's module.
    /// </summary>
    public StudentConceptState ApplyAnswer(
        StudentConceptState? state, Guid sessionId, bool wasCorrect, int attemptsUsed, int hintsUsed,
        long responseTimeMs, DateTime now)
    {
        if (state is null || state.LearningState is LearningState.New or LearningState.Exposure)
            throw new InvalidOperationException("The concept is not in a response state.");

        var rating = performance.Infer(wasCorrect, attemptsUsed, hintsUsed, responseTimeMs);
        state.LastAttemptAtUtc = now;
        if (wasCorrect) state.LastSuccessAtUtc = now;
        else state.LastFailureAtUtc = now;

        switch (state.LearningState)
        {
            case LearningState.Recognition:
                if (wasCorrect) state.LearningState = LearningState.GuidedRecall;
                break;
            case LearningState.GuidedRecall:
                state.LearningState = wasCorrect ? LearningState.FreeRecall : LearningState.Recognition;
                break;
            case LearningState.FreeRecall:
                if (!wasCorrect)
                {
                    state.LearningState = LearningState.GuidedRecall;
                    ResetFreeRecallSuccesses(state);
                    break;
                }

                var priorDueAt = state.DueAtUtc;
                var differentSession = state.LastFreeRecallSuccessSessionId != sessionId;
                var scheduledReviewWasDue = priorDueAt is not null && Utc(priorDueAt.Value) <= now;
                if (state.FreeRecallSuccessCount == 0)
                {
                    state.FreeRecallSuccessCount = 1;
                    state.LastFreeRecallSuccessSessionId = sessionId;
                    state.LastFreeRecallSuccessAtUtc = now;
                }
                else if (state.FreeRecallSuccessCount == 1 && differentSession && scheduledReviewWasDue)
                {
                    state.FreeRecallSuccessCount = 2;
                    state.LearningState = LearningState.Mastered;
                    state.LastFreeRecallSuccessSessionId = sessionId;
                    state.LastFreeRecallSuccessAtUtc = now;
                }
                break;
            case LearningState.Mastered:
                if (!wasCorrect)
                {
                    state.LearningState = LearningState.FreeRecall;
                    ResetFreeRecallSuccesses(state);
                }
                break;
            default:
                throw new InvalidOperationException("Unsupported learning transition.");
        }

        var schedule = fsrs.Schedule(state, rating, now);
        state.FsrsState = schedule.State;
        state.Difficulty = schedule.Difficulty;
        state.Stability = schedule.Stability;
        state.DueAtUtc = schedule.DueAtUtc;
        state.LastReviewAtUtc = schedule.LastReviewAtUtc;
        state.ElapsedDays = schedule.ElapsedDays;
        state.ScheduledDays = schedule.ScheduledDays;
        state.Repetitions = schedule.Repetitions;
        state.Lapses = schedule.Lapses;
        state.LastFsrsRating = rating;
        return state;
    }

    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static void ResetFreeRecallSuccesses(StudentConceptState state)
    {
        state.FreeRecallSuccessCount = 0;
        state.LastFreeRecallSuccessSessionId = null;
    }
}
