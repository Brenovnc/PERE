import { A11yModule } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage, isApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { StudentModule } from '../../core/study.models';
import { STUDY_SOURCE } from '../../core/study-source';
import { PageHeader } from '../../shared/page-header';
import { formatReviewDate } from '../../shared/review-date';
import { TeacherBadge } from '../../shared/teacher-badge';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-student-module-page',
  imports: [A11yModule, PageHeader, ThemeToggle, TeacherBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-module-page.html',
  host: { '(document:keydown.escape)': 'cancelReset()' },
})
export class StudentModulePage implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly study = inject(STUDY_SOURCE);
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly moduleId = input.required<string>();
  /** Query parameter: "free" opens the concept choice (link from the end of a session). */
  readonly practice = input<string>();

  protected readonly module = signal<StudentModule | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly freeChoiceOpen = signal(false);
  protected readonly selectedConcept = signal('');
  protected readonly confirmReset = signal(false);
  protected readonly allWords = signal(false);

  protected readonly concepts = computed(() => this.module()?.concepts ?? []);
  protected readonly nextReview = computed(() => {
    const value = this.module()?.nextReviewAtUtc;
    return value ? formatReviewDate(value) : 'nenhuma agendada';
  });
  protected readonly hasNormalSession = computed(
    () => this.module()?.activeSessionMode === 'NORMAL',
  );
  protected readonly hasFreeSession = computed(
    () => this.module()?.activeSessionMode === 'FREE_PRACTICE',
  );

  ngOnInit(): void {
    if (this.practice() === 'free') this.freeChoiceOpen.set(true);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.module.set(await this.study.getModule(this.moduleId()));
    } catch (error) {
      if (isApiError(error, 401)) return;
      this.error.set(
        isApiError(error, 404)
          ? 'Este módulo não está disponível para sua turma.'
          : errorMessage(error, 'Não foi possível carregar o módulo.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async begin(mode: 'normal' | 'free', conceptId: string | null = null): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const session =
        mode === 'normal'
          ? await this.study.startSession(this.moduleId())
          : await this.study.startFreePractice(this.moduleId(), conceptId);
      await this.router.navigateByUrl(`${this.study.basePath}/sessions/${session.sessionId}`);
    } catch (error) {
      if (isApiError(error, 401)) return;
      this.error.set(
        isApiError(error, 404) ? 'Este módulo não está mais disponível.' : errorMessage(error),
      );
    } finally {
      this.busy.set(false);
    }
  }

  protected continueSession(): void {
    const sessionId = this.module()?.activeSessionId;
    if (sessionId) void this.router.navigateByUrl(`${this.study.basePath}/sessions/${sessionId}`);
  }

  protected openCrossword(): void {
    void this.router.navigate([this.study.basePath, 'modules', this.moduleId(), 'crossword'], {
      queryParams: { allWords: this.allWords() },
    });
  }

  protected cancelReset(): void {
    if (!this.busy()) this.confirmReset.set(false);
  }

  protected async resetProgress(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.study.resetModuleProgress(this.moduleId());
      this.confirmReset.set(false);
      this.module.set(await this.study.getModule(this.moduleId()));
    } catch (error) {
      if (!isApiError(error, 401)) this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected backToModules(): void {
    void this.router.navigateByUrl(this.study.basePath);
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
