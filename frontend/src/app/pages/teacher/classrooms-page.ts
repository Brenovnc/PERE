import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api-error';
import {
  ClassroomDetails,
  ClassroomSummary,
  Enrollment,
  ModuleStatus,
  ModuleSummary,
} from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { EmptyState } from '../../shared/empty-state';
import { formatLastAccess } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';

const statusLabels: Record<string, string> = { Active: 'Ativa', Archived: 'Arquivada' };
const moduleStatusLabels: Record<string, string> = {
  Published: 'Publicado',
  Archived: 'Arquivado',
  Draft: 'Rascunho',
};
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

@Component({
  selector: 'app-classrooms-page',
  imports: [PageHeader, EmptyState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './classrooms-page.html',
  styleUrl: './classrooms-page.css',
})
export class ClassroomsPage {
  private readonly teacher = inject(TeacherService);

  protected readonly statusLabels = statusLabels;
  protected readonly moduleStatusLabels = moduleStatusLabels;
  protected readonly plural = plural;
  protected readonly formatLastAccess = formatLastAccess;
  protected readonly classrooms = signal<ClassroomSummary[]>([]);
  protected readonly modules = signal<ModuleSummary[]>([]);
  protected readonly selected = signal<ClassroomDetails | null>(null);
  protected readonly enrollments = signal<Enrollment[]>([]);
  protected readonly moduleId = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly pending = computed(() =>
    this.enrollments().filter((item) => item.status === 'PENDING'),
  );
  protected readonly approved = computed(() =>
    this.enrollments().filter((item) => item.status === 'APPROVED'),
  );
  protected readonly archived = computed(() => this.selected()?.status === 'Archived');
  /** Published modules not yet in the selected classroom. */
  protected readonly assignable = computed(() => {
    const assigned = new Set(this.selected()?.modules.map((m) => m.id));
    return this.modules().filter((m) => m.status === ModuleStatus.Published && !assigned.has(m.id));
  });

  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      const [classrooms, modules] = await Promise.all([
        this.teacher.listClassrooms(),
        this.teacher.listModules(),
      ]);
      this.classrooms.set(classrooms);
      this.modules.set(modules);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  private async refreshList(): Promise<void> {
    this.classrooms.set(await this.teacher.listClassrooms());
  }

  private async loadSelected(id: string): Promise<void> {
    const [classroom, enrollments] = await Promise.all([
      this.teacher.getClassroom(id),
      this.teacher.listEnrollments(id),
    ]);
    this.selected.set(classroom);
    this.enrollments.set(enrollments);
  }

  /** Runs an action, shows its result and reloads the list and the open classroom. */
  private async run<T>(
    action: () => Promise<T>,
    message: string | ((result: T) => string),
  ): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const result = await action();
      await this.refreshList();
      const selected = this.selected();
      if (selected) await this.loadSelected(selected.id);
      this.notice.set(typeof message === 'string' ? message : message(result));
      return true;
    } catch (error) {
      this.error.set(errorMessage(error));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async open(id: string): Promise<void> {
    this.error.set('');
    this.notice.set('');
    this.busy.set(true);
    try {
      await this.loadSelected(id);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected close(): void {
    this.selected.set(null);
    this.enrollments.set([]);
    this.notice.set('');
    this.error.set('');
  }

  private formValues(event: SubmitEvent): { form: HTMLFormElement; name: string; code: string } {
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    return { form, name: String(data.get('name') ?? ''), code: String(data.get('code') ?? '') };
  }

  protected async create(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const { form, name, code } = this.formValues(event);
    if (await this.run(() => this.teacher.createClassroom(name, code), 'Turma criada.'))
      form.reset();
  }

  protected save(event: SubmitEvent): void {
    event.preventDefault();
    const { name, code } = this.formValues(event);
    const id = this.selected()!.id;
    void this.run(() => this.teacher.updateClassroom(id, name, code), 'Turma atualizada.');
  }

  protected regenerateCode(): void {
    if (
      !window.confirm(
        'Gerar um novo código? O código atual deixará de funcionar para novos pedidos.',
      )
    )
      return;
    const id = this.selected()!.id;
    void this.run(() => this.teacher.regenerateCode(id), 'Novo código gerado.');
  }

  protected archive(): void {
    const id = this.selected()!.id;
    void this.run(() => this.teacher.archiveClassroom(id), 'Turma arquivada.');
  }

  protected assign(event: SubmitEvent): void {
    event.preventDefault();
    const classroomId = this.selected()!.id;
    const moduleId = this.moduleId();
    if (!moduleId) return;
    void this.run(async () => {
      await this.teacher.assignModule(classroomId, moduleId);
      this.moduleId.set('');
    }, 'Módulo associado.');
  }

  protected unassign(moduleId: string): void {
    const classroomId = this.selected()!.id;
    void this.run(() => this.teacher.unassignModule(classroomId, moduleId), 'Módulo desassociado.');
  }

  protected approve(student: Enrollment): void {
    const id = this.selected()!.id;
    void this.run(
      () => this.teacher.approveEnrollment(id, student.studentId),
      `${student.name} foi aprovado(a).`,
    );
  }

  protected reject(student: Enrollment): void {
    const id = this.selected()!.id;
    void this.run(
      () => this.teacher.rejectEnrollment(id, student.studentId),
      `Pedido de ${student.name} recusado.`,
    );
  }

  protected approveAll(): void {
    const id = this.selected()!.id;
    void this.run(
      () => this.teacher.approveAll(id),
      ({ approved }) => `${plural(approved, 'pedido aprovado', 'pedidos aprovados')}.`,
    );
  }

  protected remove(student: Enrollment): void {
    if (
      !window.confirm(
        `Remover ${student.name} da turma? O aluno perde o acesso aos módulos desta turma; o progresso continua salvo.`,
      )
    )
      return;
    const id = this.selected()!.id;
    void this.run(
      () => this.teacher.removeEnrollment(id, student.studentId),
      `${student.name} foi removido(a) da turma.`,
    );
  }
}
