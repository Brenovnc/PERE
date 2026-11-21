import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { StudentModule } from '../core/study.models';
import { moduleSummary } from './engine/engine';
import { ModuleImportError, parseModuleDocument, toModuleContent } from './engine/exchange';
import { createProgress, VisitorProgress } from './engine/model';
import { StoredModule, VisitorStore } from './visitor-store';

export interface PublicCommunityItem {
  id: string;
  title: string;
  description: string | null;
  subject: string;
  activeConceptCount: number;
  authorName: string;
  authorInstitution: string | null;
  sharedAtUtc: string | null;
  crosswordEnabled: boolean;
}

export interface PublicCommunityPage {
  items: PublicCommunityItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LocalModule {
  stored: StoredModule;
  summary: StudentModule;
}

/** Backup file with the modules and the progress saved in this browser. */
export interface ProgressFile {
  format: 'pere-visitor-progress';
  version: 1;
  exportedAt: string;
  modules: { module: StoredModule; progress: VisitorProgress | null }[];
}

const communityModuleId = (communityId: string) => `community-${communityId}`;

/** Visitor home: community modules (public API), module files and the progress backup. */
@Injectable({ providedIn: 'root' })
export class VisitorService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(VisitorStore);

  searchCommunity(search: string, page: number): Promise<PublicCommunityPage> {
    const params = new HttpParams().set('search', search).set('page', page).set('pageSize', 24);
    return firstValueFrom(
      this.http.get<PublicCommunityPage>('/api/public/community/modules', { params }),
    );
  }

  async listLocal(): Promise<LocalModule[]> {
    const [modules, progress] = await Promise.all([
      this.store.listModules(),
      this.store.listProgress(),
    ]);
    const now = new Date();
    return modules
      .map((stored) => ({
        stored,
        summary: moduleSummary(
          stored.id,
          toModuleContent(stored.document),
          progress.find((p) => p.moduleId === stored.id) ?? createProgress(stored.id, now),
          { name: stored.authorName, institution: stored.authorInstitution },
          now,
        ),
      }))
      .sort(
        (a, b) =>
          b.summary.pendingReviews - a.summary.pendingReviews ||
          a.summary.title.localeCompare(b.summary.title, 'pt-BR'),
      );
  }

  /** Downloads a community module (as a schemaVersion 1 document) and saves it here. */
  async addFromCommunity(item: PublicCommunityItem): Promise<string> {
    const response = await firstValueFrom(
      this.http.get(`/api/public/community/modules/${item.id}`, {
        observe: 'response',
        responseType: 'text',
      }),
    );
    const id = communityModuleId(item.id);
    await this.store.putModule({
      id,
      source: 'community',
      communityId: item.id,
      etag: response.headers.get('ETag'),
      authorName: item.authorName,
      authorInstitution: item.authorInstitution,
      document: parseModuleDocument(response.body ?? ''),
      addedAt: new Date().toISOString(),
    });
    return id;
  }

  /**
   * Asks the server, with the saved ETag, whether community modules changed. Unchanged modules
   * cost a 304 with no body. Progress is kept: it is indexed by the concept ids of the file.
   */
  async refreshCommunityModules(): Promise<number> {
    const modules = (await this.store.listModules()).filter((m) => m.communityId);
    let updated = 0;
    for (const module of modules) {
      try {
        const response = await firstValueFrom(
          this.http.get(`/api/public/community/modules/${module.communityId}`, {
            observe: 'response',
            responseType: 'text',
            headers: module.etag ? { 'If-None-Match': module.etag } : {},
          }),
        );
        const etag = response.headers.get('ETag');
        if (response.status === 304 || etag === module.etag) continue;
        await this.store.putModule({
          ...module,
          etag,
          document: parseModuleDocument(response.body ?? ''),
        });
        updated++;
      } catch (error) {
        // 304: nothing changed. 404: the author removed it; the copy saved here keeps working.
        if (!(error instanceof HttpErrorResponse)) throw error;
      }
    }
    return updated;
  }

  async importModuleFile(text: string): Promise<string> {
    const id = `file-${crypto.randomUUID()}`;
    await this.store.putModule({
      id,
      source: 'file',
      communityId: null,
      etag: null,
      authorName: null,
      authorInstitution: null,
      document: parseModuleDocument(text),
      addedAt: new Date().toISOString(),
    });
    return id;
  }

  removeModule(id: string): Promise<void> {
    return this.store.deleteModule(id);
  }

  async exportProgress(): Promise<Blob> {
    const [modules, progress] = await Promise.all([
      this.store.listModules(),
      this.store.listProgress(),
    ]);
    const file: ProgressFile = {
      format: 'pere-visitor-progress',
      version: 1,
      exportedAt: new Date().toISOString(),
      modules: modules.map((module) => ({
        module,
        progress: progress.find((p) => p.moduleId === module.id) ?? null,
      })),
    };
    return new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
  }

  /** Checks a backup file before anything is written. */
  readProgressFile(text: string): ProgressFile {
    let file: Partial<ProgressFile>;
    try {
      file = JSON.parse(text) as Partial<ProgressFile>;
    } catch {
      throw new ModuleImportError('O arquivo não é um JSON válido.');
    }
    if (
      file.format !== 'pere-visitor-progress' ||
      file.version !== 1 ||
      !Array.isArray(file.modules)
    )
      throw new ModuleImportError('Este não é um arquivo de progresso do PERE.');
    for (const entry of file.modules) {
      if (!entry?.module?.id || !entry.module.document)
        throw new ModuleImportError('O arquivo de progresso está incompleto.');
      parseModuleDocument(JSON.stringify(entry.module.document));
    }
    return file as ProgressFile;
  }

  /** Saves every module of the file, replacing the ones with the same id. */
  async importProgress(file: ProgressFile): Promise<number> {
    for (const { module, progress } of file.modules) {
      await this.store.putModule(module);
      if (progress) await this.store.putProgress({ ...progress, moduleId: module.id });
    }
    return file.modules.length;
  }

  localIdForCommunity(communityId: string): string {
    return communityModuleId(communityId);
  }
}
