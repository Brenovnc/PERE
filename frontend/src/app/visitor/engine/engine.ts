/**
 * Visitor learning engine: the browser version of ActivitySelectionService, LearningProgressionService,
 * PerformanceRatingService, FsrsService and the grading in StudySessionService. The rules must stay
 * the same as the backend's; see frontend/README.md for the known differences.
 *
 * Functions change the progress object they receive; the caller saves it afterwards.
 * `now` and `random` are parameters so tests can control time and shuffling.
 */
import { Card, createEmptyCard, fsrs, Grade, Rating, State } from 'ts-fsrs';
import type {
  AnswerResponse,
  CrosswordEntry,
  ExposureSegment,
  StudentModule,
  StudyActivity,
  StudySession,
} from '../../core/study.models';
import { EngineConcept, ModuleContent } from './exchange';
import {
  ActivityType,
  ConceptState,
  FsrsRatingName,
  LearningState,
  Presentation,
  SavedCard,
  Snapshot,
  VisitorProgress,
  VisitorSession,
} from './model';

export interface EngineContext {
  now: Date;
  random: () => number;
  /** Creates ids for sessions and presentations. */
  newId: () => string;
}

/** A rule of the engine was broken (same messages as the API errors). */
export class EngineError extends Error {}

const sessionLength = 10;
const recentFailureWindowMs = 14 * 86_400_000;
/** Same scheduler options as FsrsService (FSRS-6 defaults, no fuzzing). */
const scheduler = fsrs({ enable_fuzz: false });
/** Only a few finished sessions are kept, so the saved progress does not grow forever. */
const keptSessions = 5;

const compatibleTypes: Record<LearningState, ActivityType[]> = {
  NEW: [],
  EXPOSURE: ['EXPOSURE'],
  RECOGNITION: ['TRUE_FALSE', 'ORDERING'],
  GUIDED_RECALL: ['FILL_BLANK', 'ORDERING'],
  FREE_RECALL: ['GUESS_CONCEPT'],
  MASTERED: ['GUESS_CONCEPT'],
};

const primaryType: Record<LearningState, ActivityType> = {
  NEW: 'EXPOSURE',
  EXPOSURE: 'EXPOSURE',
  RECOGNITION: 'TRUE_FALSE',
  GUIDED_RECALL: 'FILL_BLANK',
  FREE_RECALL: 'GUESS_CONCEPT',
  MASTERED: 'GUESS_CONCEPT',
};

const time = (value: string | null | undefined) => (value ? Date.parse(value) : null);
const dueAt = (state: ConceptState | undefined) => time(state?.card?.due);

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function newState(): ConceptState {
  return {
    learningState: 'NEW',
    freeRecallSuccessCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFreeRecallSuccessAt: null,
    lastFreeRecallSuccessSessionId: null,
    card: null,
    lastRating: null,
  };
}

// ---------------------------------------------------------------------------------------------
// Activity selection (ActivitySelectionService.PresentNextAsync)
// ---------------------------------------------------------------------------------------------

interface Candidate {
  concept: EngineConcept;
  state: ConceptState | undefined;
  learningState: LearningState;
  tier: number;
  type: ActivityType;
  activityId: string | null;
  snapshot: Snapshot;
}

/** Due first (0), then failed in the last 14 days (1), then in progress (2), then new (3). */
function tierOf(
  learningState: LearningState,
  state: ConceptState | undefined,
  now: number,
): number {
  const due = dueAt(state);
  if (due !== null && due <= now) return 0;
  const failure = time(state?.lastFailureAt);
  if (failure !== null && failure >= now - recentFailureWindowMs) return 1;
  return learningState === 'NEW' ? 3 : 2;
}

function prerequisitesMastered(concept: EngineConcept, progress: VisitorProgress): boolean {
  return concept.prerequisites.every((id) => progress.states[id]?.learningState === 'MASTERED');
}

function buildActivities(
  concept: EngineConcept,
  type: ActivityType,
  random: () => number,
): { activityId: string | null; snapshot: Snapshot }[] {
  const conceptName = concept.name;
  switch (type) {
    case 'EXPOSURE':
      return concept.keywords.length > 0
        ? [
            {
              activityId: null,
              snapshot: {
                type,
                conceptName,
                definition: concept.definition,
                keywords: concept.keywords,
              },
            },
          ]
        : [];
    case 'TRUE_FALSE':
      return concept.trueFalse.map((a) => ({
        activityId: a.id,
        snapshot: {
          type,
          conceptName,
          statement: a.statement,
          isCorrect: a.isCorrect,
          explanation: a.explanation,
        },
      }));
    case 'FILL_BLANK':
      return concept.fillBlank.map((a) => ({
        activityId: a.id,
        snapshot: {
          type,
          conceptName,
          text: a.text,
          slots: [...a.answers].sort((x, y) => x.slotNumber - y.slotNumber),
          options: shuffle(
            [...a.answers.map((answer) => answer.correctText), ...a.distractors],
            random,
          ),
        },
      }));
    case 'GUESS_CONCEPT':
      return concept.clues.length > 0
        ? [{ activityId: null, snapshot: { type, conceptName, clues: concept.clues } }]
        : [];
    case 'ORDERING':
      return concept.ordering.map((a) => ({
        activityId: a.id,
        snapshot: {
          type,
          conceptName,
          instruction: a.instruction,
          items: shuffle(
            a.items.map((text, position) => ({ id: `${a.id}-${position}`, position, text })),
            random,
          ),
        },
      }));
  }
}

/** Same order as the LINQ OrderBy/ThenBy chain in the backend. */
function compareCandidates(a: Candidate, b: Candidate): number {
  const nullsFirst = (x: number | null, y: number | null) =>
    x === y ? 0 : x === null ? -1 : y === null ? 1 : x - y;
  return (
    a.tier - b.tier ||
    nullsFirst(a.tier === 0 ? dueAt(a.state) : null, b.tier === 0 ? dueAt(b.state) : null) ||
    -nullsFirst(
      a.tier === 1 ? time(a.state?.lastFailureAt) : null,
      b.tier === 1 ? time(b.state?.lastFailureAt) : null,
    ) ||
    Number(a.type !== primaryType[a.learningState]) -
      Number(b.type !== primaryType[b.learningState]) ||
    a.concept.id.localeCompare(b.concept.id) ||
    (a.activityId ?? '').localeCompare(b.activityId ?? '')
  );
}

/** Free practice: avoid repeating the last concept, favor the least practiced, random type. */
function chooseFreePractice(
  candidates: Candidate[],
  previousConceptId: string | null,
  random: () => number,
): Candidate {
  const alternatives = candidates.filter((c) => c.concept.id !== previousConceptId);
  const available = alternatives.length > 0 ? alternatives : candidates;
  const leastUsedTier = Math.min(...available.map((c) => c.tier));
  const leastUsed = available.filter((c) => c.tier === leastUsedTier);
  const types = [...new Set(leastUsed.map((c) => c.type))];
  const selectedType = types[Math.floor(random() * types.length)];
  const sameType = leastUsed.filter((c) => c.type === selectedType);
  return sameType[Math.floor(random() * sameType.length)];
}

function presentNext(
  content: ModuleContent,
  progress: VisitorProgress,
  session: VisitorSession,
  ctx: EngineContext,
): Presentation | null {
  if (session.status !== 'ACTIVE' || session.completedActivities >= sessionLength) return null;
  const now = ctx.now.getTime();
  const free = session.mode === 'FREE_PRACTICE';
  const concepts = session.selectedConceptId
    ? content.concepts.filter((c) => c.id === session.selectedConceptId)
    : content.concepts;

  const candidates: Candidate[] = [];
  for (const concept of concepts) {
    const state = progress.states[concept.id];
    const learningState = state?.learningState ?? 'NEW';
    if (!free) {
      const due = dueAt(state);
      const notDue = due === null || due > now;
      if (learningState === 'MASTERED' && notDue) continue;
      if (learningState === 'FREE_RECALL' && (state?.freeRecallSuccessCount ?? 0) > 0 && notDue)
        continue;
      if (learningState === 'NEW' && !prerequisitesMastered(concept, progress)) continue;
    }
    const tier = free
      ? (progress.practiceUsage[concept.id] ?? 0)
      : tierOf(learningState, state, now);
    const types: ActivityType[] = free
      ? ['TRUE_FALSE', 'FILL_BLANK', 'GUESS_CONCEPT', 'ORDERING']
      : compatibleTypes[learningState === 'NEW' ? 'EXPOSURE' : learningState];
    for (const type of types)
      for (const choice of buildActivities(concept, type, ctx.random)) {
        const used = session.presentations.some(
          (p) =>
            p.conceptId === concept.id && p.type === type && p.activityId === choice.activityId,
        );
        if (!used) candidates.push({ concept, state, learningState, tier, type, ...choice });
      }
  }
  if (candidates.length === 0) return null;

  const previousConceptId = session.presentations.at(-1)?.conceptId ?? null;
  let chosen: Candidate;
  if (free) {
    chosen = chooseFreePractice(candidates, previousConceptId, ctx.random);
  } else {
    const ordered = [...candidates].sort(compareCandidates);
    const minTier = Math.min(...candidates.map((c) => c.tier));
    chosen =
      ordered.find((c) => c.tier !== minTier || c.concept.id !== previousConceptId) ?? ordered[0];
  }

  if (!free && chosen.learningState === 'NEW') {
    const state = progress.states[chosen.concept.id] ?? newState();
    state.learningState = 'EXPOSURE';
    state.lastAttemptAt = ctx.now.toISOString();
    progress.states[chosen.concept.id] = state;
  }
  if (free)
    progress.practiceUsage[chosen.concept.id] =
      (progress.practiceUsage[chosen.concept.id] ?? 0) + 1;

  const sequence = session.presentations.length + 1;
  const presentation: Presentation = {
    id: ctx.newId(),
    sequence,
    conceptId: chosen.concept.id,
    type: chosen.type,
    activityId: chosen.activityId,
    startedAt: ctx.now.toISOString(),
    answeredAt: null,
    // The first clue of "guess the concept" is shown right away.
    revealedCount: chosen.type === 'GUESS_CONCEPT' ? 1 : 0,
    snapshot: chosen.snapshot,
  };
  session.presentations.push(presentation);
  session.totalActivities = Math.min(sequence, sessionLength);
  return presentation;
}

// ---------------------------------------------------------------------------------------------
// Sessions (StudySessionService)
// ---------------------------------------------------------------------------------------------

function complete(session: VisitorSession, now: Date): void {
  session.status = 'COMPLETED';
  session.completedAt ??= now.toISOString();
  session.totalActivities = session.completedActivities;
}

function currentPresentation(session: VisitorSession): Presentation | null {
  return [...session.presentations].reverse().find((p) => p.answeredAt === null) ?? null;
}

export function activeSession(progress: VisitorProgress): VisitorSession | null {
  return progress.sessions.find((s) => s.status === 'ACTIVE') ?? null;
}

export function findSession(progress: VisitorProgress, sessionId: string): VisitorSession {
  const session = progress.sessions.find((s) => s.id === sessionId);
  if (!session) throw new EngineError('A sessão ou o módulo não foi encontrado.');
  return session;
}

function trimSessions(progress: VisitorProgress): void {
  const finished = progress.sessions.filter((s) => s.status !== 'ACTIVE');
  const dropped = new Set(finished.slice(0, Math.max(0, finished.length - keptSessions)));
  progress.sessions = progress.sessions.filter((s) => !dropped.has(s));
}

/** Starts a session, or returns the active one when it has the same mode. */
export function startSession(
  content: ModuleContent,
  progress: VisitorProgress,
  mode: VisitorSession['mode'],
  selectedConceptId: string | null,
  ctx: EngineContext,
): VisitorSession {
  if (mode === 'FREE_PRACTICE' && selectedConceptId !== null)
    if (!content.concepts.some((c) => c.id === selectedConceptId))
      throw new EngineError('A sessão ou o módulo não foi encontrado.');
  const existing = activeSession(progress);
  if (existing) {
    if (existing.mode !== mode)
      throw new EngineError(
        'Conclua ou abandone a sessão atual antes de iniciar outro modo de estudo.',
      );
    if (!currentPresentation(existing) && !presentNext(content, progress, existing, ctx))
      complete(existing, ctx.now);
    return existing;
  }
  const session: VisitorSession = {
    id: ctx.newId(),
    mode,
    selectedConceptId: mode === 'FREE_PRACTICE' ? selectedConceptId : null,
    status: 'ACTIVE',
    totalActivities: 0,
    completedActivities: 0,
    startedAt: ctx.now.toISOString(),
    completedAt: null,
    presentations: [],
  };
  progress.sessions.push(session);
  if (!presentNext(content, progress, session, ctx)) complete(session, ctx.now);
  trimSessions(progress);
  return session;
}

/** Reveals the next keyword (exposure) or clue (guess the concept). */
export function revealHint(
  progress: VisitorProgress,
  sessionId: string,
  presentationId: string,
): void {
  const presentation = requireCurrent(findActive(progress, sessionId), presentationId);
  const { snapshot } = presentation;
  const hints =
    snapshot.type === 'EXPOSURE'
      ? snapshot.keywords
      : snapshot.type === 'GUESS_CONCEPT'
        ? snapshot.clues
        : null;
  if (!hints) throw new EngineError('Esta atividade não possui pistas progressivas.');
  if (presentation.revealedCount >= hints.length)
    throw new EngineError('Todas as pistas desta atividade já foram reveladas.');
  presentation.revealedCount++;
}

export function abandonSession(progress: VisitorProgress, sessionId: string, now: Date): void {
  const session = findActive(progress, sessionId);
  session.status = 'ABANDONED';
  session.completedAt = now.toISOString();
}

/** Abandons the active session and erases the official progress (practice history is kept). */
export function resetProgress(progress: VisitorProgress, now: Date): void {
  const active = activeSession(progress);
  if (active) {
    active.status = 'ABANDONED';
    active.completedAt = now.toISOString();
  }
  progress.states = {};
}

function findActive(progress: VisitorProgress, sessionId: string): VisitorSession {
  const session = findSession(progress, sessionId);
  if (session.status !== 'ACTIVE') throw new EngineError('A sessão não está ativa.');
  return session;
}

function requireCurrent(session: VisitorSession, presentationId: string): Presentation {
  const current = currentPresentation(session);
  if (!current) throw new EngineError('A sessão não possui atividade atual.');
  if (current.id !== presentationId)
    throw new EngineError('Esta apresentação já foi respondida ou não é a atividade atual.');
  return current;
}

// ---------------------------------------------------------------------------------------------
// Grading (StudySessionService.Correct)
// ---------------------------------------------------------------------------------------------

const sameText = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function isCorrect(presentation: Presentation, answer: unknown): boolean {
  if (!isObject(answer)) throw new EngineError('A resposta deve ser um objeto JSON válido.');
  const { snapshot } = presentation;
  switch (snapshot.type) {
    case 'EXPOSURE':
      if (answer['completed'] !== true || presentation.revealedCount !== snapshot.keywords.length)
        throw new EngineError('Revele todas as palavras-chave antes de concluir a exposição.');
      return true;
    case 'TRUE_FALSE':
      if (typeof answer['choice'] !== 'boolean')
        throw new EngineError('Informe true ou false como resposta.');
      return answer['choice'] === snapshot.isCorrect;
    case 'FILL_BLANK': {
      const submitted = answer['answers'];
      const valid =
        Array.isArray(submitted) &&
        submitted.length === snapshot.slots.length &&
        submitted.every((x) => isObject(x) && typeof x['text'] === 'string') &&
        new Set(submitted.map((x) => (x as Record<string, unknown>)['slotNumber'])).size ===
          submitted.length &&
        submitted.every((x) =>
          snapshot.slots.some(
            (slot) => slot.slotNumber === (x as Record<string, unknown>)['slotNumber'],
          ),
        );
      if (!valid)
        throw new EngineError(
          'Envie exatamente uma resposta para cada lacuna, sem extras ou duplicatas.',
        );
      const bySlot = new Map(
        (submitted as { slotNumber: number; text: string }[]).map((x) => [x.slotNumber, x.text]),
      );
      return snapshot.slots.every((slot) =>
        sameText(bySlot.get(slot.slotNumber) ?? '', slot.correctText),
      );
    }
    case 'GUESS_CONCEPT':
      return sameText(
        typeof answer['text'] === 'string' ? answer['text'] : '',
        snapshot.conceptName,
      );
    case 'ORDERING': {
      const submitted = answer['itemIds'];
      const expected = [...snapshot.items].sort((a, b) => a.position - b.position).map((x) => x.id);
      if (
        !Array.isArray(submitted) ||
        submitted.length !== expected.length ||
        new Set(submitted).size !== submitted.length ||
        submitted.some((id) => !expected.includes(id as string))
      )
        throw new EngineError('A sequência deve conter cada item exatamente uma vez.');
      return submitted.every((id, index) => id === expected[index]);
    }
  }
}

function correctAnswer(snapshot: Snapshot): unknown {
  switch (snapshot.type) {
    case 'EXPOSURE':
      return null;
    case 'TRUE_FALSE':
      return { choice: snapshot.isCorrect, explanation: snapshot.explanation };
    case 'FILL_BLANK':
      return {
        answers: snapshot.slots.map((s) => ({ slotNumber: s.slotNumber, text: s.correctText })),
      };
    case 'GUESS_CONCEPT':
      return { text: snapshot.conceptName };
    case 'ORDERING':
      return {
        itemIds: [...snapshot.items].sort((a, b) => a.position - b.position).map((x) => x.id),
      };
  }
}

// ---------------------------------------------------------------------------------------------
// Progression and scheduling (LearningProgressionService, PerformanceRatingService, FsrsService)
// ---------------------------------------------------------------------------------------------

export function inferRating(
  wasCorrect: boolean,
  attemptsUsed: number,
  hintsUsed: number,
  responseTimeMs: number,
): FsrsRatingName {
  if (!wasCorrect) return 'Again';
  if (attemptsUsed > 1 || hintsUsed >= 2) return 'Hard';
  if (attemptsUsed === 1 && hintsUsed === 0 && responseTimeMs <= 5_000) return 'Easy';
  return 'Good';
}

function toCard(saved: SavedCard | null, now: Date): Card {
  if (!saved) return createEmptyCard(now);
  return {
    ...saved,
    state: saved.state as State,
    due: new Date(saved.due),
    last_review: saved.last_review ? new Date(saved.last_review) : undefined,
  };
}

function toSavedCard(card: Card): SavedCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.toISOString(),
  };
}

/** Applies an answer: learning-state transition plus FSRS scheduling. */
export function applyAnswer(
  state: ConceptState,
  sessionId: string,
  wasCorrect: boolean,
  attemptsUsed: number,
  hintsUsed: number,
  responseTimeMs: number,
  now: Date,
): void {
  if (state.learningState === 'NEW' || state.learningState === 'EXPOSURE')
    throw new EngineError('O conceito não está em um estado de resposta.');
  const rating = inferRating(wasCorrect, attemptsUsed, hintsUsed, responseTimeMs);
  const nowIso = now.toISOString();
  state.lastAttemptAt = nowIso;
  if (wasCorrect) state.lastSuccessAt = nowIso;
  else state.lastFailureAt = nowIso;

  const resetFreeRecall = () => {
    state.freeRecallSuccessCount = 0;
    state.lastFreeRecallSuccessSessionId = null;
  };
  switch (state.learningState) {
    case 'RECOGNITION':
      if (wasCorrect) state.learningState = 'GUIDED_RECALL';
      break;
    case 'GUIDED_RECALL':
      state.learningState = wasCorrect ? 'FREE_RECALL' : 'RECOGNITION';
      break;
    case 'FREE_RECALL': {
      if (!wasCorrect) {
        state.learningState = 'GUIDED_RECALL';
        resetFreeRecall();
        break;
      }
      // Mastery needs two free-recall successes: the second in another session, after the review was due.
      const due = dueAt(state);
      const differentSession = state.lastFreeRecallSuccessSessionId !== sessionId;
      const reviewWasDue = due !== null && due <= now.getTime();
      if (state.freeRecallSuccessCount === 0) {
        state.freeRecallSuccessCount = 1;
        state.lastFreeRecallSuccessSessionId = sessionId;
        state.lastFreeRecallSuccessAt = nowIso;
      } else if (state.freeRecallSuccessCount === 1 && differentSession && reviewWasDue) {
        state.freeRecallSuccessCount = 2;
        state.learningState = 'MASTERED';
        state.lastFreeRecallSuccessSessionId = sessionId;
        state.lastFreeRecallSuccessAt = nowIso;
      }
      break;
    }
    case 'MASTERED':
      if (!wasCorrect) {
        state.learningState = 'FREE_RECALL';
        resetFreeRecall();
      }
      break;
  }

  const next = scheduler.next(toCard(state.card, now), now, Rating[rating] as Grade);
  state.card = toSavedCard(next.card);
  state.lastRating = rating;
}

/** Grades the answer, updates progress (normal mode only) and chooses the next activity. */
export function submitAnswer(
  content: ModuleContent,
  progress: VisitorProgress,
  sessionId: string,
  presentationId: string,
  answer: unknown,
  hintsUsed: number,
  ctx: EngineContext,
): AnswerResponse {
  const session = findActive(progress, sessionId);
  const presentation = requireCurrent(session, presentationId);
  const { snapshot } = presentation;
  const responseTimeMs = Math.max(0, ctx.now.getTime() - Date.parse(presentation.startedAt));
  const wasCorrect = isCorrect(presentation, answer);
  // Only "guess the concept" reports hints; the other activities always count as one attempt, no hints.
  let hints = 0;
  if (snapshot.type === 'GUESS_CONCEPT') {
    if (hintsUsed < 0 || hintsUsed > presentation.revealedCount)
      throw new EngineError('A quantidade de pistas deve corresponder às pistas reveladas.');
    hints = hintsUsed;
  }

  let learningState = 'FREE_PRACTICE';
  if (session.mode === 'NORMAL') {
    const state = progress.states[presentation.conceptId];
    if (snapshot.type === 'EXPOSURE') {
      if (!state || state.learningState !== 'EXPOSURE')
        throw new EngineError('A exposição só pode ser concluída a partir de EXPOSURE.');
      state.learningState = 'RECOGNITION';
      state.lastAttemptAt = ctx.now.toISOString();
    } else {
      if (!state) throw new EngineError('O conceito não está em um estado de resposta.');
      applyAnswer(state, session.id, wasCorrect, 1, hints, responseTimeMs, ctx.now);
    }
    learningState = progress.states[presentation.conceptId].learningState;
  }

  presentation.answeredAt = ctx.now.toISOString();
  session.completedActivities++;
  let next: Presentation | null = null;
  if (session.completedActivities >= sessionLength) complete(session, ctx.now);
  else next = presentNext(content, progress, session, ctx);
  if (!next && session.status === 'ACTIVE') complete(session, ctx.now);

  return {
    wasCorrect,
    feedback:
      snapshot.type === 'TRUE_FALSE' && wasCorrect
        ? snapshot.explanation
        : wasCorrect
          ? 'Resposta correta.'
          : 'Resposta incorreta.',
    learningState,
    completedActivities: session.completedActivities,
    totalActivities: session.totalActivities,
    sessionStatus: session.status,
    nextActivity: next ? publicActivity(next) : null,
    correctAnswer: correctAnswer(snapshot),
  };
}

// ---------------------------------------------------------------------------------------------
// Views in the same shape as the API, so the student screens and minigames are reused
// ---------------------------------------------------------------------------------------------

/** Splits the definition around keywords (ActivitySelectionService.BuildExposureSegments). */
export function exposureSegments(
  definition: string,
  keywords: string[],
  revealedCount: number,
): ExposureSegment[] {
  const lower = definition.toLowerCase();
  const matches: { start: number; end: number; keywordIndex: number }[] = [];
  keywords.forEach((keyword, keywordIndex) => {
    if (!keyword.trim()) return;
    const needle = keyword.toLowerCase();
    for (let from = 0; from < definition.length;) {
      const start = lower.indexOf(needle, from);
      if (start < 0) break;
      matches.push({ start, end: start + keyword.length, keywordIndex });
      from = start + keyword.length;
    }
  });
  matches.sort(
    (a, b) =>
      a.start - b.start || b.end - b.start - (a.end - a.start) || a.keywordIndex - b.keywordIndex,
  );
  const segments: ExposureSegment[] = [];
  const represented = new Set<number>();
  let cursor = 0;
  for (const match of matches) {
    if (match.start < cursor) continue;
    if (match.start > cursor)
      segments.push({ text: definition.slice(cursor, match.start), keywordIndex: null });
    represented.add(match.keywordIndex);
    segments.push({
      text: match.keywordIndex < revealedCount ? keywords[match.keywordIndex] : null,
      keywordIndex: match.keywordIndex,
    });
    cursor = match.end;
  }
  if (cursor < definition.length)
    segments.push({ text: definition.slice(cursor), keywordIndex: null });
  keywords.forEach((keyword, index) => {
    if (!represented.has(index))
      segments.push({ text: index < revealedCount ? keyword : null, keywordIndex: index });
  });
  return segments;
}

/** The activity without its answers (ActivitySelectionService.MapPublic). */
export function publicActivity(presentation: Presentation): StudyActivity {
  const base = {
    presentationId: presentation.id,
    conceptId: presentation.conceptId,
    startedAtUtc: presentation.startedAt,
  };
  const { snapshot } = presentation;
  switch (snapshot.type) {
    case 'EXPOSURE':
      return {
        ...base,
        type: 'EXPOSURE',
        payload: {
          keywordCount: snapshot.keywords.length,
          revealedCount: presentation.revealedCount,
          revealedKeywords: snapshot.keywords.slice(0, presentation.revealedCount),
          segments: exposureSegments(
            snapshot.definition,
            snapshot.keywords,
            presentation.revealedCount,
          ),
        },
      };
    case 'TRUE_FALSE':
      return { ...base, type: 'TRUE_FALSE', payload: { statement: snapshot.statement } };
    case 'FILL_BLANK':
      return {
        ...base,
        type: 'FILL_BLANK',
        payload: {
          text: snapshot.text,
          slotNumbers: snapshot.slots.map((s) => s.slotNumber),
          options: snapshot.options,
        },
      };
    case 'GUESS_CONCEPT':
      return {
        ...base,
        type: 'GUESS_CONCEPT',
        payload: {
          clueCount: snapshot.clues.length,
          clues: snapshot.clues.slice(0, presentation.revealedCount),
        },
      };
    case 'ORDERING':
      return {
        ...base,
        type: 'ORDERING',
        payload: {
          instruction: snapshot.instruction,
          items: snapshot.items.map((item) => ({ id: item.id, text: item.text })),
        },
      };
  }
}

export function sessionView(moduleId: string, session: VisitorSession): StudySession {
  const current = session.status === 'ACTIVE' ? currentPresentation(session) : null;
  return {
    sessionId: session.id,
    moduleId,
    mode: session.mode,
    status: session.status,
    totalActivities: session.totalActivities,
    completedActivities: session.completedActivities,
    startedAtUtc: session.startedAt,
    completedAtUtc: session.completedAt,
    activity: current ? publicActivity(current) : null,
  };
}

/** Progress summary in the shape of StudentModuleResponse (StudentStudyCatalogService). */
export function moduleSummary(
  moduleId: string,
  content: ModuleContent,
  progress: VisitorProgress,
  author: { name: string | null; institution: string | null },
  now: Date,
): StudentModule {
  const nowMs = now.getTime();
  const states = content.concepts
    .map((c) => progress.states[c.id])
    .filter((s): s is ConceptState => !!s);
  const mastered = states.filter((s) => s.learningState === 'MASTERED').length;
  const learning = states.filter((s) =>
    ['EXPOSURE', 'RECOGNITION', 'GUIDED_RECALL', 'FREE_RECALL'].includes(s.learningState),
  ).length;
  const scheduled = states.filter((s) => s.learningState !== 'NEW' && dueAt(s) !== null);
  const pending = scheduled.filter((s) => dueAt(s)! <= nowMs).length;
  const future = scheduled.map((s) => dueAt(s)!).filter((due) => due > nowMs);
  const active = activeSession(progress);
  const total = content.concepts.length;
  return {
    id: moduleId,
    title: content.title,
    description: content.description,
    subject: content.subject,
    activeSessionId: active?.id ?? null,
    activeConcepts: total,
    masteredConcepts: mastered,
    learningConcepts: learning,
    notStartedConcepts: total - mastered - learning,
    pendingReviews: pending,
    progressPercent: total === 0 ? 0 : Math.round((mastered * 100) / total),
    nextReviewAtUtc: future.length ? new Date(Math.min(...future)).toISOString() : null,
    activeSessionMode: active?.mode ?? null,
    concepts: [...content.concepts]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((c) => ({ id: c.id, name: c.name })),
    crosswordEnabled: content.crosswordEnabled,
    crosswordAllowAllWords: content.crosswordAllowAllWords,
    teacherName: author.name,
    teacherInstitution: author.institution,
  };
}

/** Crossword words: of mastered concepts, or all of them when the module allows it. */
export function crosswordEntries(
  content: ModuleContent,
  progress: VisitorProgress,
  allWords: boolean,
): CrosswordEntry[] {
  if (!content.crosswordEnabled)
    throw new EngineError('A cruzadinha não está habilitada neste módulo.');
  if (allWords && !content.crosswordAllowAllWords)
    throw new EngineError('O professor não permitiu o uso de todas as palavras.');
  return content.concepts
    .filter((c) => c.crossword)
    .filter((c) => allWords || progress.states[c.id]?.learningState === 'MASTERED')
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((c) => ({ id: c.id, word: c.crossword!.word, clue: c.crossword!.clue }));
}
