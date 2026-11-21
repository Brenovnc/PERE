import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import {
  ClassroomSummary,
  ModuleStatus,
  moduleStatusLabels,
  ModuleSummary,
  TeacherDashboard,
} from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';

@Component({
  selector: 'app-teacher-home-page',
  imports: [PageHeader, EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './teacher-home-page.html',
  styleUrl: './teacher-home-page.css',
})
export class TeacherHomePage {
  private readonly auth = inject(AuthService);
  private readonly teacher = inject(TeacherService);

  protected readonly statusLabels = moduleStatusLabels;
  protected readonly summary = signal<TeacherDashboard | null>(null);
  protected readonly modules = signal<ModuleSummary[]>([]);
  protected readonly classrooms = signal<ClassroomSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');

  protected readonly firstName = computed(
    () => this.auth.user()?.name?.trim().split(/\s+/)[0] || 'professor',
  );

  protected readonly steps = computed(() => [
    {
      done: this.modules().length > 0,
      label: 'Criar seu primeiro módulo',
      path: '/teacher/modules',
    },
    {
      done: this.modules().some((m) => m.status === ModuleStatus.Published),
      label: 'Publicar um módulo',
      path: '/teacher/modules',
    },
    {
      done: this.classrooms().length > 0,
      label: 'Criar sua primeira turma',
      path: '/teacher/classrooms',
    },
    {
      done: (this.summary()?.activeStudents ?? 0) > 0,
      label: 'Aprovar os primeiros alunos',
      path: '/teacher/classrooms',
    },
  ]);
  protected readonly completedSteps = computed(() => this.steps().filter((s) => s.done).length);

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const [summary, modules, classrooms] = await Promise.all([
        this.teacher.dashboard(),
        this.teacher.listModules(),
        this.teacher.listClassrooms(),
      ]);
      const newestFirst = (a: { updatedAtUtc: string }, b: { updatedAtUtc: string }) =>
        b.updatedAtUtc.localeCompare(a.updatedAtUtc);
      this.summary.set(summary);
      this.modules.set([...modules].sort(newestFirst));
      this.classrooms.set(classrooms.filter((c) => c.status === 'Active').sort(newestFirst));
    } catch {
      this.error.set('Não foi possível carregar a página inicial.');
    } finally {
      this.loading.set(false);
    }
  }
}
