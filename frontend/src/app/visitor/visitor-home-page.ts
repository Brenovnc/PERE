import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage } from '../core/api-error';
import { AuthService } from '../core/auth.service';
import { EmptyState } from '../shared/empty-state';
import { downloadBlob } from '../shared/format';
import { PageHeader } from '../shared/page-header';
import { TeacherBadge } from '../shared/teacher-badge';
import { ThemeToggle } from '../shared/theme-toggle';
import { ModuleImportError } from './engine/exchange';
import { LocalModule, PublicCommunityItem, VisitorService } from './visitor.service';

/** Errors of an imported file come with a list of details. */
function importMessage(error: unknown): string {
  if (error instanceof ModuleImportError)
    return [error.message, ...error.details.slice(0, 5)].join(' ');
  return errorMessage(error);
}

/** Visitor mode: study community modules or module files without a classroom; progress stays in this browser. */
@Component({
  selector: 'app-visitor-home-page',
  imports: [PageHeader, ThemeToggle, TeacherBadge, EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './visitor-home-page.html',
})
export class VisitorHomePage {
  private readonly visitor = inject(VisitorService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly local = signal<LocalModule[]>([]);
  protected readonly loadingLocal = signal(true);
  protected readonly community = signal<PublicCommunityItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly busy = signal('');
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly savedCommunityIds = computed(
    () =>
      new Set(this.local().flatMap((m) => (m.stored.communityId ? [m.stored.communityId] : []))),
  );
  /** Link back to the signed-in area, if any. */
  protected readonly homeLink = computed(() => {
    const user = this.auth.user();
    return user ? this.auth.homeFor(user.role) : null;
  });

  constructor() {
    void this.init();
    effect(() => {
      const search = this.search();
      untracked(() => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => void this.loadCommunity(1, search), 300);
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  private async init(): Promise<void> {
    await this.reloadLocal();
    // Checks for new versions of the community modules saved here (a 304 when nothing changed).
    try {
      if ((await this.visitor.refreshCommunityModules()) > 0) await this.reloadLocal();
    } catch {
      // Offline or API unavailable: the copies saved in the browser still work.
    }
  }

  private async reloadLocal(): Promise<void> {
    try {
      this.local.set(await this.visitor.listLocal());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loadingLocal.set(false);
    }
  }

  private async loadCommunity(page: number, search = this.search()): Promise<void> {
    try {
      const result = await this.visitor.searchCommunity(search, page);
      this.community.update((current) =>
        page === 1 ? result.items : [...current, ...result.items],
      );
      this.total.set(result.total);
      this.page.set(page);
    } catch (error) {
      this.error.set(errorMessage(error, 'Não foi possível carregar os módulos da comunidade.'));
    }
  }

  protected loadMore(): void {
    void this.loadCommunity(this.page() + 1);
  }

  private async run(key: string, action: () => Promise<void>): Promise<void> {
    if (this.busy()) return;
    this.busy.set(key);
    this.error.set('');
    this.notice.set('');
    try {
      await action();
    } catch (error) {
      this.error.set(importMessage(error));
    } finally {
      this.busy.set('');
    }
  }

  protected add(item: PublicCommunityItem): void {
    void this.run(item.id, async () => {
      await this.visitor.addFromCommunity(item);
      await this.reloadLocal();
      this.notice.set(`“${item.title}” foi salvo neste navegador. Bons estudos!`);
    });
  }

  protected open(module: LocalModule): void {
    const sessionId = module.summary.activeSessionId;
    void this.router.navigateByUrl(
      sessionId ? `/visitor/sessions/${sessionId}` : `/visitor/modules/${module.stored.id}`,
    );
  }

  protected openCommunity(item: PublicCommunityItem): void {
    void this.router.navigateByUrl(`/visitor/modules/${this.visitor.localIdForCommunity(item.id)}`);
  }

  protected remove(module: LocalModule): void {
    if (
      !window.confirm(
        `Remover “${module.summary.title}” deste navegador? O progresso dele será apagado (exporte o progresso antes, se quiser guardar uma cópia).`,
      )
    )
      return;
    void this.run(module.stored.id, async () => {
      await this.visitor.removeModule(module.stored.id);
      await this.reloadLocal();
      this.notice.set('Módulo removido deste navegador.');
    });
  }

  private async readFile(event: Event): Promise<string | null> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return null;
    if (file.size > 5 * 1_048_576)
      throw new ModuleImportError('O arquivo pode ter no máximo 5 MiB.');
    return file.text();
  }

  protected importModule(event: Event): void {
    void this.run('import-module', async () => {
      const text = await this.readFile(event);
      if (text === null) return;
      const id = await this.visitor.importModuleFile(text);
      await this.router.navigateByUrl(`/visitor/modules/${id}`);
    });
  }

  protected exportProgress(): void {
    void this.run('export', async () => {
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(await this.visitor.exportProgress(), `pere-progresso-${date}.json`);
      this.notice.set('Arquivo de progresso exportado.');
    });
  }

  protected importProgress(event: Event): void {
    void this.run('import-progress', async () => {
      const text = await this.readFile(event);
      if (text === null) return;
      const file = this.visitor.readProgressFile(text);
      const replaced = file.modules.filter((m) =>
        this.local().some((l) => l.stored.id === m.module.id),
      );
      if (
        replaced.length > 0 &&
        !window.confirm(
          `${replaced.length} módulo(s) do arquivo já estão neste navegador e terão o progresso substituído. Continuar?`,
        )
      )
        return;
      const count = await this.visitor.importProgress(file);
      await this.reloadLocal();
      this.notice.set(`Progresso importado: ${count} módulo(s).`);
    });
  }
}
