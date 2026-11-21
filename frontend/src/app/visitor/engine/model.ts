/** Saved visitor progress. Everything is plain JSON so it can go to IndexedDB and to the backup file. */

export type LearningState =
  'NEW' | 'EXPOSURE' | 'RECOGNITION' | 'GUIDED_RECALL' | 'FREE_RECALL' | 'MASTERED';

export type ActivityType = 'EXPOSURE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'GUESS_CONCEPT' | 'ORDERING';
export type FsrsRatingName = 'Again' | 'Hard' | 'Good' | 'Easy';

/** ts-fsrs card with dates as ISO strings. */
export interface SavedCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string;
}

/** Same fields as StudentConceptState in the backend. */
export interface ConceptState {
  learningState: LearningState;
  freeRecallSuccessCount: number;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFreeRecallSuccessAt: string | null;
  lastFreeRecallSuccessSessionId: string | null;
  card: SavedCard | null;
  lastRating: FsrsRatingName | null;
}

/** What was shown, frozen when the activity was chosen (SessionActivityPresentation.SnapshotJson). */
export type Snapshot =
  | { type: 'EXPOSURE'; conceptName: string; definition: string; keywords: string[] }
  | {
      type: 'TRUE_FALSE';
      conceptName: string;
      statement: string;
      isCorrect: boolean;
      explanation: string;
    }
  | {
      type: 'FILL_BLANK';
      conceptName: string;
      text: string;
      slots: { slotNumber: number; correctText: string }[];
      options: string[];
    }
  | { type: 'GUESS_CONCEPT'; conceptName: string; clues: string[] }
  | {
      type: 'ORDERING';
      conceptName: string;
      instruction: string;
      items: { id: string; position: number; text: string }[];
    };

export interface Presentation {
  id: string;
  sequence: number;
  conceptId: string;
  type: ActivityType;
  activityId: string | null;
  startedAt: string;
  answeredAt: string | null;
  revealedCount: number;
  snapshot: Snapshot;
}

export interface VisitorSession {
  id: string;
  mode: 'NORMAL' | 'FREE_PRACTICE';
  selectedConceptId: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
  totalActivities: number;
  completedActivities: number;
  startedAt: string;
  completedAt: string | null;
  presentations: Presentation[];
}

export interface VisitorProgress {
  moduleId: string;
  states: Record<string, ConceptState>;
  /** The active session and a few recent ones (the session page can still show their summary). */
  sessions: VisitorSession[];
  /** Free-practice activities shown per concept; free practice favors the least practiced ones. */
  practiceUsage: Record<string, number>;
  updatedAt: string;
}

export function createProgress(moduleId: string, now: Date): VisitorProgress {
  return { moduleId, states: {}, sessions: [], practiceUsage: {}, updatedAt: now.toISOString() };
}
