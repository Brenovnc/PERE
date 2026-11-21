import { inject, Injectable } from '@angular/core';
import { StudySource } from '../core/study-source';
import {
  AnswerResponse,
  CrosswordEntry,
  StartedSession,
  StudentModule,
  StudyActivity,
  StudySession,
} from '../core/study.models';
import * as engine from './engine/engine';
import { ModuleContent, toModuleContent } from './engine/exchange';
import { createProgress, VisitorProgress, VisitorSession } from './engine/model';
import { StoredModule, VisitorStore } from './visitor-store';

interface Loaded {
  stored: StoredModule;
  content: ModuleContent;
  progress: VisitorProgress;
}

/**
 * Study data for visitors: the engine runs in the browser and every change is saved to IndexedDB
 * right away (each answer, hint and session start).
 */
@Injectable({ providedIn: 'root' })
export class VisitorStudySource implements StudySource {
  private readonly store = inject(VisitorStore);
  readonly basePath = '/visitor';

  private context(): engine.EngineContext {
    return { now: new Date(), random: Math.random, newId: () => crypto.randomUUID() };
  }

  private async load(moduleId: string): Promise<Loaded> {
    const stored = await this.store.getModule(moduleId);
    if (!stored) throw new Error('Este módulo não está salvo neste navegador.');
    const progress =
      (await this.store.getProgress(moduleId)) ?? createProgress(moduleId, new Date());
    return { stored, content: toModuleContent(stored.document), progress };
  }

  private async loadBySession(sessionId: string): Promise<Loaded> {
    const owner = (await this.store.listProgress()).find((p) =>
      p.sessions.some((s) => s.id === sessionId),
    );
    if (!owner) throw new Error('A sessão ou o módulo não foi encontrado.');
    return this.load(owner.moduleId);
  }

  private async save(progress: VisitorProgress): Promise<void> {
    progress.updatedAt = new Date().toISOString();
    await this.store.putProgress(progress);
  }

  async getModule(moduleId: string): Promise<StudentModule> {
    const { stored, content, progress } = await this.load(moduleId);
    return engine.moduleSummary(
      moduleId,
      content,
      progress,
      { name: stored.authorName, institution: stored.authorInstitution },
      new Date(),
    );
  }

  startSession(moduleId: string): Promise<StartedSession> {
    return this.start(moduleId, 'NORMAL', null);
  }

  startFreePractice(moduleId: string, conceptId: string | null): Promise<StartedSession> {
    return this.start(moduleId, 'FREE_PRACTICE', conceptId);
  }

  private async start(
    moduleId: string,
    mode: VisitorSession['mode'],
    conceptId: string | null,
  ): Promise<StartedSession> {
    const { content, progress } = await this.load(moduleId);
    const session = engine.startSession(content, progress, mode, conceptId, this.context());
    await this.save(progress);
    return engine.sessionView(moduleId, session);
  }

  async resetModuleProgress(moduleId: string): Promise<unknown> {
    const { progress } = await this.load(moduleId);
    engine.resetProgress(progress, new Date());
    await this.save(progress);
    return null;
  }

  async getSession(sessionId: string): Promise<StudySession> {
    const { stored, progress } = await this.loadBySession(sessionId);
    return engine.sessionView(stored.id, engine.findSession(progress, sessionId));
  }

  async reveal(sessionId: string, presentationId: string): Promise<unknown> {
    const { progress } = await this.loadBySession(sessionId);
    engine.revealHint(progress, sessionId, presentationId);
    await this.save(progress);
    return null;
  }

  async submit(
    sessionId: string,
    activity: StudyActivity,
    answer: unknown,
    hintsUsed: number,
  ): Promise<AnswerResponse> {
    const { content, progress } = await this.loadBySession(sessionId);
    const response = engine.submitAnswer(
      content,
      progress,
      sessionId,
      activity.presentationId,
      answer,
      hintsUsed,
      this.context(),
    );
    await this.save(progress);
    return response;
  }

  async abandon(sessionId: string): Promise<unknown> {
    const { progress } = await this.loadBySession(sessionId);
    engine.abandonSession(progress, sessionId, new Date());
    await this.save(progress);
    return null;
  }

  async getCrossword(moduleId: string, allWords: boolean): Promise<CrosswordEntry[]> {
    const { content, progress } = await this.load(moduleId);
    return engine.crosswordEntries(content, progress, allWords);
  }
}
