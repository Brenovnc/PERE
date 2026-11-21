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
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api-error';
import {
  CommunityItem,
  CommunityMineItem,
  ModuleStatus,
  ModuleSummary,
} from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-community-page',
  imports: [PageHeader, EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './community-page.html',
  styleUrl: './community-page.css',
})
export class CommunityPage {
  private readonly teacher = inject(TeacherService);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly mine = signal<CommunityMineItem[]>([]);
  protected readonly modules = signal<ModuleSummary[]>([]);
  protected readonly items = signal<CommunityItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly subject = signal('');
  protected readonly shareOpen = signal(false);
  /** Id of the item being shared, removed or downloaded. */
  protected readonly busy = signal('');
  protected readonly error = signal('');
  protected readonly success = signal('');

  /** Published modules that were not shared yet. */
  protected readonly available = computed(() =>
    this.modules().filter(
      (m) =>
        m.status === ModuleStatus.Published &&
        !this.mine().some((item) => item.communitySourceModuleId === m.id),
    ),
  );

  constructor() {
    void Promise.all([this.reloadMine(), this.reloadModules()]).catch((e: unknown) =>
      this.error.set(errorMessage(e)),
    );
    // Searches 300 ms after the last keystroke (and once right away).
    effect(() => {
      const search = this.search();
      const subject = this.subject();
      untracked(() => {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(
          () =>
            void this.load(1, search, subject).catch((e: unknown) =>
              this.error.set(errorMessage(e)),
            ),
          300,
        );
      });
    });
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
  }

  private async reloadMine(): Promise<void> {
    this.mine.set(await this.teacher.myCommunityModules());
  }

  private async reloadModules(): Promise<void> {
    this.modules.set(await this.teacher.listModules());
  }

  private async load(
    page: number,
    search = this.search(),
    subject = this.subject(),
  ): Promise<void> {
    const result = await this.teacher.searchCommunity(search, subject, page);
    this.items.update((current) => (page === 1 ? result.items : [...current, ...result.items]));
    this.total.set(result.total);
    this.page.set(page);
  }

  protected loadMore(): void {
    void this.load(this.page() + 1).catch((e: unknown) => this.error.set(errorMessage(e)));
  }

  protected async share(moduleId: string): Promise<void> {
    this.busy.set(moduleId);
    this.error.set('');
    try {
      await this.teacher.shareModule(moduleId);
      await Promise.all([this.reloadMine(), this.reloadModules()]);
      this.shareOpen.set(false);
    } catch (e) {
      this.error.set(errorMessage(e, 'Falha ao enviar.'));
    } finally {
      this.busy.set('');
    }
  }

  protected async remove(id: string): Promise<void> {
    if (
      !window.confirm('Excluir definitivamente? Professores que já baixaram mantêm a cópia deles.')
    )
      return;
    this.busy.set(id);
    try {
      await this.teacher.removeCommunityModule(id);
      await this.reloadMine();
    } catch (e) {
      this.error.set(errorMessage(e, 'Falha ao excluir.'));
    } finally {
      this.busy.set('');
    }
  }

  protected async download(item: CommunityItem): Promise<void> {
    this.busy.set(item.id);
    this.error.set('');
    try {
      await this.teacher.downloadCommunityModule(item.id);
      this.success.set(`“${item.title}” foi adicionado aos seus módulos como rascunho.`);
      await this.load(1);
    } catch (e) {
      this.error.set(errorMessage(e, 'Falha ao baixar.'));
    } finally {
      this.busy.set('');
    }
  }

  protected sharedDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString('pt-BR') : '';
  }
}
