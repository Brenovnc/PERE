import { InjectionToken } from '@angular/core';
import {
  AnswerResponse,
  CrosswordEntry,
  StartedSession,
  StudentModule,
  StudyActivity,
  StudySession,
} from './study.models';

/**
 * Where the module, session and crossword screens get their data. Classroom students use the API
 * (StudyService); visitors use the engine that runs in the browser (VisitorStudySource).
 */
export interface StudySource {
  /** Root of the area: "/student" or "/visitor". Screens build their links from it. */
  readonly basePath: string;
  getModule(moduleId: string): Promise<StudentModule>;
  startSession(moduleId: string): Promise<StartedSession>;
  startFreePractice(moduleId: string, conceptId: string | null): Promise<StartedSession>;
  resetModuleProgress(moduleId: string): Promise<unknown>;
  getSession(sessionId: string): Promise<StudySession>;
  reveal(sessionId: string, presentationId: string): Promise<unknown>;
  submit(
    sessionId: string,
    activity: StudyActivity,
    answer: unknown,
    hintsUsed: number,
  ): Promise<AnswerResponse>;
  abandon(sessionId: string): Promise<unknown>;
  getCrossword(moduleId: string, allWords: boolean): Promise<CrosswordEntry[]>;
}

/** Provided by the student and visitor routes. */
export const STUDY_SOURCE = new InjectionToken<StudySource>('STUDY_SOURCE');
