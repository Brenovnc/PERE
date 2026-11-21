import { Injectable } from '@angular/core';
import { ModuleDocument } from './engine/exchange';
import { VisitorProgress } from './engine/model';

/** A module saved in this browser, with the file it came from. */
export interface StoredModule {
  /** "community:<id>" for community modules, "file:<uuid>" for imported files. */
  id: string;
  source: 'community' | 'file';
  communityId: string | null;
  /** ETag of the community version saved here, used to check for updates. */
  etag: string | null;
  authorName: string | null;
  authorInstitution: string | null;
  document: ModuleDocument;
  addedAt: string;
}

const databaseName = 'pere-visitor';
const modulesStore = 'modules';
const progressStore = 'progress';

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Visitor data in IndexedDB. Nothing here is sent to the server. */
@Injectable({ providedIn: 'root' })
export class VisitorStore {
  private database: Promise<IDBDatabase> | null = null;

  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('Este navegador não permite salvar dados locais (IndexedDB).'));
        return;
      }
      const req = indexedDB.open(databaseName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(modulesStore, { keyPath: 'id' });
        req.result.createObjectStore(progressStore, { keyPath: 'moduleId' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () =>
        reject(req.error ?? new Error('Não foi possível abrir o armazenamento local.'));
    });
    return this.database;
  }

  private async store(name: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    return (await this.open()).transaction(name, mode).objectStore(name);
  }

  async listModules(): Promise<StoredModule[]> {
    return request(
      (await this.store(modulesStore, 'readonly')).getAll() as IDBRequest<StoredModule[]>,
    );
  }

  async getModule(id: string): Promise<StoredModule | undefined> {
    return request(
      (await this.store(modulesStore, 'readonly')).get(id) as IDBRequest<StoredModule | undefined>,
    );
  }

  async putModule(module: StoredModule): Promise<void> {
    await request((await this.store(modulesStore, 'readwrite')).put(module));
  }

  async listProgress(): Promise<VisitorProgress[]> {
    return request(
      (await this.store(progressStore, 'readonly')).getAll() as IDBRequest<VisitorProgress[]>,
    );
  }

  async getProgress(moduleId: string): Promise<VisitorProgress | undefined> {
    return request(
      (await this.store(progressStore, 'readonly')).get(moduleId) as IDBRequest<
        VisitorProgress | undefined
      >,
    );
  }

  async putProgress(progress: VisitorProgress): Promise<void> {
    await request((await this.store(progressStore, 'readwrite')).put(progress));
  }

  /** Removes the module and its progress in one transaction. */
  async deleteModule(id: string): Promise<void> {
    const transaction = (await this.open()).transaction([modulesStore, progressStore], 'readwrite');
    transaction.objectStore(modulesStore).delete(id);
    transaction.objectStore(progressStore).delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}
