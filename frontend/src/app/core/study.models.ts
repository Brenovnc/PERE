export type SessionMode = 'NORMAL' | 'FREE_PRACTICE';
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type EnrollmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StudentClassroom {
  classroomId: string;
  name: string;
  teacherName: string;
  status: EnrollmentStatus;
  requestedAtUtc: string;
  decidedAtUtc: string | null;
}

export interface StudentModule {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  activeSessionId: string | null;
  activeConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  notStartedConcepts: number;
  pendingReviews: number;
  progressPercent: number;
  nextReviewAtUtc: string | null;
  activeSessionMode: SessionMode | null;
  concepts: { id: string; name: string }[] | null;
  crosswordEnabled: boolean;
  crosswordAllowAllWords: boolean;
  teacherName: string | null;
  teacherInstitution: string | null;
}

export interface CrosswordEntry {
  id: string;
  word: string;
  clue: string;
}

interface ActivityBase {
  presentationId: string;
  conceptId: string;
  startedAtUtc: string;
}

export interface ExposureSegment {
  text: string | null;
  keywordIndex: number | null;
}

export interface ExposureActivity extends ActivityBase {
  type: 'EXPOSURE';
  payload: {
    keywordCount: number;
    revealedCount: number;
    revealedKeywords: string[];
    segments: ExposureSegment[];
  };
}

export interface TrueFalseActivity extends ActivityBase {
  type: 'TRUE_FALSE';
  payload: { statement: string };
}

export interface FillBlankActivity extends ActivityBase {
  type: 'FILL_BLANK';
  payload: { text: string; slotNumbers: number[]; options: string[] };
}

export interface GuessConceptActivity extends ActivityBase {
  type: 'GUESS_CONCEPT';
  payload: { clueCount: number; clues: string[] };
}

export interface OrderingItem {
  id: string;
  text: string;
}

export interface OrderingActivity extends ActivityBase {
  type: 'ORDERING';
  payload: { instruction: string; items: OrderingItem[] };
}

export type StudyActivity =
  | ExposureActivity
  | TrueFalseActivity
  | FillBlankActivity
  | GuessConceptActivity
  | OrderingActivity;

export interface StudySession {
  sessionId: string;
  moduleId: string;
  mode: SessionMode;
  status: SessionStatus;
  totalActivities: number;
  completedActivities: number;
  startedAtUtc: string;
  completedAtUtc: string | null;
  activity: StudyActivity | null;
}

export type StartedSession = Omit<StudySession, 'startedAtUtc' | 'completedAtUtc'>;

export interface AnswerResponse {
  wasCorrect: boolean;
  feedback: string;
  learningState: string;
  completedActivities: number;
  totalActivities: number;
  sessionStatus: SessionStatus;
  nextActivity: StudyActivity | null;
  correctAnswer: unknown;
}

/** What a minigame sends when the student answers. */
export interface ActivityAnswer {
  answer: unknown;
  hintsUsed: number;
}
