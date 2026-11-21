import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AnswerResponse,
  CrosswordEntry,
  StartedSession,
  StudentClassroom,
  StudentModule,
  StudyActivity,
  StudySession,
} from './study.models';
import { StudySource } from './study-source';

/** Client for the student endpoints (/api/student/...). */
@Injectable({ providedIn: 'root' })
export class StudyService implements StudySource {
  private readonly http = inject(HttpClient);
  readonly basePath = '/student';

  listClassrooms(): Promise<StudentClassroom[]> {
    return firstValueFrom(this.http.get<StudentClassroom[]>('/api/student/classrooms'));
  }

  joinClassroom(code: string): Promise<StudentClassroom> {
    return firstValueFrom(
      this.http.post<StudentClassroom>('/api/student/classrooms/join', { code }),
    );
  }

  listModules(): Promise<StudentModule[]> {
    return firstValueFrom(this.http.get<StudentModule[]>('/api/student/modules'));
  }

  getModule(moduleId: string): Promise<StudentModule> {
    return firstValueFrom(this.http.get<StudentModule>(`/api/student/modules/${moduleId}`));
  }

  getCrossword(moduleId: string, allWords: boolean): Promise<CrosswordEntry[]> {
    const params = new HttpParams().set('allWords', allWords);
    return firstValueFrom(
      this.http.get<CrosswordEntry[]>(`/api/student/modules/${moduleId}/crossword`, { params }),
    );
  }

  startSession(moduleId: string): Promise<StartedSession> {
    return firstValueFrom(
      this.http.post<StartedSession>(`/api/student/modules/${moduleId}/sessions`, null),
    );
  }

  startFreePractice(moduleId: string, conceptId: string | null): Promise<StartedSession> {
    return firstValueFrom(
      this.http.post<StartedSession>(`/api/student/modules/${moduleId}/free-practice/sessions`, {
        conceptId,
      }),
    );
  }

  resetModuleProgress(moduleId: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/student/modules/${moduleId}/reset-progress`, null));
  }

  getSession(sessionId: string): Promise<StudySession> {
    return firstValueFrom(this.http.get<StudySession>(`/api/student/sessions/${sessionId}`));
  }

  reveal(sessionId: string, presentationId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.post(
        `/api/student/sessions/${sessionId}/activities/${presentationId}/reveal`,
        null,
      ),
    );
  }

  submit(
    sessionId: string,
    activity: StudyActivity,
    answer: unknown,
    hintsUsed: number,
  ): Promise<AnswerResponse> {
    return firstValueFrom(
      this.http.post<AnswerResponse>(`/api/student/sessions/${sessionId}/answer`, {
        presentationId: activity.presentationId,
        type: activity.type,
        answer,
        attemptsUsed: 1,
        hintsUsed,
      }),
    );
  }

  abandon(sessionId: string): Promise<unknown> {
    return firstValueFrom(this.http.post(`/api/student/sessions/${sessionId}/abandon`, null));
  }
}
