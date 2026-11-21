import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { errorMessage, isApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { EnrollmentStatus, StudentClassroom, StudentModule } from '../../core/study.models';
import { StudyService } from '../../core/study.service';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import { TeacherBadge } from '../../shared/teacher-badge';
import { ThemeToggle } from '../../shared/theme-toggle';

const statusLabels: Record<EnrollmentStatus, string> = {
  PENDING: 'Aguardando aprovação',
  APPROVED: 'Aprovada',
  REJECTED: 'Recusada',
};

const statusClasses: Record<EnrollmentStatus, string> = {
  PENDING: 'border-warning-border bg-warning text-warning-text',
  APPROVED: 'border-success-border bg-success text-success-text',
  REJECTED: 'border-danger-border bg-danger text-danger-text',
};

@Component({
  selector: 'app-student-modules-page',
  imports: [PageHeader, ThemeToggle, TeacherBadge, EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-modules-page.html',
})
export class StudentModulesPage {
  private readonly auth = inject(AuthService);
  private readonly study = inject(StudyService);
  private readonly router = inject(Router);

  protected readonly statusLabels = statusLabels;
  protected readonly statusClasses = statusClasses;
  protected readonly modules = signal<StudentModule[]>([]);
  protected readonly classrooms = signal<StudentClassroom[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly joining = signal(false);
  protected readonly joinError = signal('');
  protected readonly joinNotice = signal('');

  /** Modules with pending reviews first, then alphabetical. */
  protected readonly orderedModules = computed(() =>
    [...this.modules()].sort(
      (a, b) => b.pendingReviews - a.pendingReviews || a.title.localeCompare(b.title, 'pt-BR'),
    ),
  );

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [classrooms, modules] = await Promise.all([
        this.study.listClassrooms(),
        this.study.listModules(),
      ]);
      this.classrooms.set(classrooms);
      this.modules.set(modules);
    } catch (error) {
      if (!isApiError(error, 401))
        this.error.set(errorMessage(error, 'Não foi possível carregar os módulos.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async join(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const code = String(new FormData(form).get('code') ?? '').trim();
    if (!code || this.joining()) return;
    this.joining.set(true);
    this.joinError.set('');
    this.joinNotice.set('');
    try {
      const classroom = await this.study.joinClassroom(code);
      this.classrooms.update((current) =>
        [...current.filter((item) => item.classroomId !== classroom.classroomId), classroom].sort(
          (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
        ),
      );
      this.joinNotice.set(
        `Pedido enviado para a turma ${classroom.name}. Aguarde a aprovação do professor.`,
      );
      form.reset();
    } catch (error) {
      if (!isApiError(error, 401)) this.joinError.set(errorMessage(error));
    } finally {
      this.joining.set(false);
    }
  }

  protected open(module: StudentModule): void {
    void this.router.navigateByUrl(
      module.activeSessionId
        ? `/student/sessions/${module.activeSessionId}`
        : `/student/modules/${module.id}`,
    );
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
