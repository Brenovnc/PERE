/** Module status as the API sends it (the enum number). */
export enum ModuleStatus {
  Draft = 0,
  Published = 1,
  Archived = 2,
}

export const moduleStatusLabels: Record<ModuleStatus, string> = {
  [ModuleStatus.Draft]: 'Rascunho',
  [ModuleStatus.Published]: 'Publicado',
  [ModuleStatus.Archived]: 'Arquivado',
};

export interface ModuleSummary {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  version: number;
  status: ModuleStatus;
  createdAtUtc: string;
  updatedAtUtc: string;
  activeConceptCount: number;
  crosswordEnabled: boolean;
  crosswordAllowAllWords: boolean;
  communityOriginAuthor: string | null;
}

export interface RecognitionActivity {
  id: string;
  statement: string;
  isCorrect: boolean;
  explanation: string;
  isActive: boolean;
}

export interface FillBlankActivity {
  id: string;
  text: string;
  isActive: boolean;
  answers: { slotNumber: number; correctText: string }[];
  distractors: string[];
}

export interface OrderingActivity {
  id: string;
  instruction: string;
  isActive: boolean;
  items: string[];
}

export interface Concept {
  id: string;
  moduleId: string;
  name: string;
  definition: string;
  isActive: boolean;
  keywords: string[];
  clues: string[];
  prerequisiteIds: string[];
  recognitionActivities: RecognitionActivity[];
  fillBlankActivities: FillBlankActivity[];
  orderingActivities: OrderingActivity[];
  crosswordWord: string | null;
  crosswordClue: string | null;
}

export interface ModuleDetails extends Omit<ModuleSummary, 'activeConceptCount'> {
  concepts: Concept[];
  isCommunityListing: boolean;
}

export interface ModuleInput {
  title: string;
  description: string;
  subject: string;
  version: number;
  crosswordEnabled: boolean;
  crosswordAllowAllWords: boolean;
}

export interface ConceptInput {
  name: string;
  definition: string;
  keywords: string[];
  clues: string[];
  prerequisiteIds: string[];
  recognitionActivities: {
    id?: string;
    statement: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  fillBlankActivities: {
    id?: string;
    text: string;
    answers: { slotNumber: number; correctText: string }[];
    distractors: string[];
  }[];
  orderingActivities: { id?: string; instruction: string; items: string[] }[];
  crosswordWord: string;
  crosswordClue: string;
}

export interface PublicationValidation {
  isValid: boolean;
  errors: { conceptId: string | null; code: string; message: string }[];
}

export interface ClassroomSummary {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Archived';
  studentCount: number;
  pendingCount: number;
  moduleCount: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface ClassroomDetails {
  id: string;
  name: string;
  code: string;
  status: 'Active' | 'Archived';
  modules: { id: string; title: string; subject: string; version: number; status: string }[];
  studentCount: number;
  pendingCount: number;
}

export interface Enrollment {
  studentId: string;
  name: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAtUtc: string;
  decidedAtUtc: string | null;
  lastAccessAtUtc: string | null;
}

export interface TeacherDashboard {
  modules: number;
  activeClassrooms: number;
  activeStudents: number;
}

export interface ClassroomProgress {
  classroomId: string;
  classroomName: string;
  totalActiveConcepts: number;
  students: {
    studentId: string;
    name: string;
    email: string;
    isActive: boolean;
    progressPercent: number;
    pendingReviews: number;
    lastAccessAtUtc: string | null;
  }[];
}

export interface StudentModuleProgress {
  moduleId: string;
  title: string;
  subject: string;
  activeConcepts: number;
  masteredConcepts: number;
  learningConcepts: number;
  notStartedConcepts: number;
  pendingReviews: number;
  progressPercent: number;
}

export interface StudentProgress {
  studentId: string;
  name: string;
  email: string;
  isActive: boolean;
  modules: StudentModuleProgress[];
}

export interface StudentStatistics {
  distribution: { mastered: number; learning: number; notStarted: number };
  daily: { date: string; activities: number; correctRate: number | null }[];
  activityTypes: {
    type: string;
    attempts: number;
    correctAttempts: number;
    correctRate: number | null;
  }[];
  mostErrors: { conceptId: string; name: string; attempts: number; errorRate: number }[];
}

export interface ClassroomStatistics extends StudentStatistics {
  progressBands: { range: string; students: number }[];
}

export interface StatisticsFilters {
  days?: number;
  custom?: boolean;
  from?: string;
  to?: string;
  moduleId?: string;
  activityType?: string;
  minAttempts?: number;
}

export interface CommunityItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  activeConceptCount: number;
  authorName: string;
  authorInstitution: string | null;
  sharedAtUtc: string | null;
  downloadCount: number;
  crosswordEnabled: boolean;
  alreadyDownloaded: boolean;
}

export interface CommunityMineItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  activeConceptCount: number;
  sharedAtUtc: string | null;
  downloadCount: number;
  crosswordEnabled: boolean;
  communitySourceModuleId: string | null;
}

export interface CommunityPage {
  items: CommunityItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TeacherProfile {
  name: string;
  email: string;
  education: string | null;
  institution: string | null;
}
