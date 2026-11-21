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
import { errorMessage } from '../../../core/api-error';
import {
  ModuleDetails,
  ModuleStatus,
  moduleStatusLabels,
  ModuleSummary,
  PublicationValidation,
} from '../../../core/teacher.models';
import { TeacherService } from '../../../core/teacher.service';
import { EmptyState } from '../../../shared/empty-state';
import { downloadBlob } from '../../../shared/format';
import { PageHeader } from '../../../shared/page-header';
import {
  blankConcept,
  blankModule,
  ConceptDraft,
  draftFromConcept,
  moduleInputFrom,
  toConceptInput,
} from './concept-draft';
import { ConceptEditor } from './concept-editor';
import { ModuleFields } from './module-fields';

const maxImportBytes = 1_048_576;

@Component({
  selector: 'app-modules-page',
  imports: [PageHeader, EmptyState, ModuleFields, ConceptEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modules-page.html',
  styleUrl: './modules.css',
})
export class ModulesPage implements OnInit {
  private readonly teacher = inject(TeacherService);
  private readonly router = inject(Router);

  /** Query parameters: module to open, and "community" when coming from the community page. */
  readonly open = input<string>();
  readonly from = input<string>();

  protected readonly statusLabels = moduleStatusLabels;
  protected readonly modules = signal<ModuleSummary[]>([]);
  protected readonly selected = signal<ModuleDetails | null>(null);
  protected readonly moduleDraft = signal(blankModule());
  protected readonly conceptDraft = signal<ConceptDraft>(blankConcept());
  protected readonly validation = signal<PublicationValidation | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');

  protected readonly fromCommunity = computed(() => this.from() === 'community');
  protected readonly activeConcepts = computed(
    () => this.selected()?.concepts.filter((c) => c.isActive) ?? [],
  );
  protected readonly isArchived = computed(() => this.selected()?.status === ModuleStatus.Archived);

  ngOnInit(): void {
    void this.refreshList()
      .catch((error: unknown) => this.error.set(errorMessage(error)))
      .finally(() => this.loading.set(false));
    const id = this.open();
    if (id) void this.openModule(id);
  }

  private async refreshList(): Promise<void> {
    this.modules.set(await this.teacher.listModules());
  }

  /** Loads the module and its publication check; the concept being edited is refreshed too. */
  private async loadModule(id: string): Promise<void> {
    const [details, validation] = await Promise.all([
      this.teacher.getModule(id),
      this.teacher.validateModule(id),
    ]);
    this.selected.set(details);
    this.validation.set(validation);
    this.moduleDraft.set(moduleInputFrom(details));
    const editingId = this.conceptDraft().id;
    if (editingId) {
      const concept = details.concepts.find((c) => c.id === editingId);
      this.conceptDraft.set(concept ? draftFromConcept(concept) : blankConcept());
    }
  }

  /** Runs one action at a time, showing the result and the API error message if it fails. */
  private async run<T>(action: () => Promise<T>, success: string): Promise<T | null> {
    if (this.busy()) return null;
    this.busy.set(true);
    this.error.set('');
    this.notice.set('');
    try {
      const result = await action();
      this.notice.set(success);
      return result;
    } catch (error) {
      this.error.set(errorMessage(error));
      return null;
    } finally {
      this.busy.set(false);
    }
  }

  protected async openModule(id: string): Promise<void> {
    this.conceptDraft.set(blankConcept());
    await this.run(() => this.loadModule(id), '');
  }

  protected back(): void {
    this.selected.set(null);
    this.validation.set(null);
    this.moduleDraft.set(blankModule());
    this.conceptDraft.set(blankConcept());
    this.notice.set('');
    this.error.set('');
    if (this.fromCommunity()) void this.router.navigateByUrl('/teacher/community');
    else if (this.open()) void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected async createModule(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const created = await this.run(
      () => this.teacher.createModule(this.moduleDraft()),
      'Módulo criado.',
    );
    if (!created) return;
    this.conceptDraft.set(blankConcept());
    await this.loadModule(created.id).catch((e: unknown) => this.error.set(errorMessage(e)));
    await this.refreshList();
  }

  protected async saveModule(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const id = this.selected()!.id;
    await this.run(async () => {
      await this.teacher.updateModule(id, this.moduleDraft());
      await this.loadModule(id);
      await this.refreshList();
    }, 'Dados do módulo salvos.');
  }

  protected async saveConcept(): Promise<void> {
    const moduleId = this.selected()!.id;
    const draft = this.conceptDraft();
    const input = toConceptInput(draft);
    await this.run(
      async () => {
        const concept = draft.id
          ? await this.teacher.updateConcept(moduleId, draft.id, input)
          : await this.teacher.createConcept(moduleId, input);
        this.conceptDraft.set(draftFromConcept(concept));
        await this.loadModule(moduleId);
        await this.refreshList();
      },
      draft.id ? 'Conceito salvo.' : 'Conceito criado.',
    );
  }

  protected async duplicateConcept(): Promise<void> {
    const moduleId = this.selected()!.id;
    const conceptId = this.conceptDraft().id!;
    await this.run(async () => {
      const copy = await this.teacher.duplicateConcept(moduleId, conceptId);
      this.conceptDraft.set(draftFromConcept(copy));
      await this.loadModule(moduleId);
    }, 'Conceito duplicado.');
  }

  protected async deactivateConcept(): Promise<void> {
    const moduleId = this.selected()!.id;
    const conceptId = this.conceptDraft().id!;
    await this.run(async () => {
      await this.teacher.deactivateConcept(moduleId, conceptId);
      this.conceptDraft.set(blankConcept());
      await this.loadModule(moduleId);
      await this.refreshList();
    }, 'Conceito desativado.');
  }

  protected async duplicateModule(): Promise<void> {
    const id = this.selected()!.id;
    await this.run(async () => {
      const copy = await this.teacher.duplicateModule(id);
      this.conceptDraft.set(blankConcept());
      await this.loadModule(copy.id);
      await this.refreshList();
    }, 'Módulo duplicado.');
  }

  protected async publish(): Promise<void> {
    const id = this.selected()!.id;
    await this.run(async () => {
      await this.teacher.publishModule(id);
      await this.loadModule(id);
      await this.refreshList();
    }, 'Módulo publicado.');
  }

  protected async archive(): Promise<void> {
    const id = this.selected()!.id;
    await this.run(async () => {
      await this.teacher.archiveModule(id);
      await this.loadModule(id);
      await this.refreshList();
    }, 'Módulo arquivado.');
  }

  protected async exportModule(id: string): Promise<void> {
    await this.run(async () => {
      const file = await this.teacher.exportModule(id);
      downloadBlob(file.blob, file.fileName);
    }, 'JSON exportado.');
  }

  protected async importFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > maxImportBytes) {
      this.error.set('O arquivo JSON pode ter no máximo 1 MiB.');
      return;
    }
    await this.run(async () => {
      const imported = await this.teacher.importModule(await file.text());
      this.conceptDraft.set(blankConcept());
      await this.loadModule(imported.id);
      await this.refreshList();
    }, 'Módulo importado como rascunho.');
  }

  protected newConcept(): void {
    this.conceptDraft.set(blankConcept());
  }

  protected editConcept(concept: ModuleDetails['concepts'][number]): void {
    this.conceptDraft.set(draftFromConcept(concept));
  }

  protected conceptSummary(concept: ModuleDetails['concepts'][number]): string {
    if (!concept.isActive) return 'Desativado';
    const active = (list: { isActive: boolean }[]) => list.filter((item) => item.isActive).length;
    return (
      `${concept.keywords.length} palavras-chave ·${concept.clues.length}/3 pistas · ` +
      `${active(concept.recognitionActivities)}/3 verdadeiro/falso · ` +
      `${active(concept.fillBlankActivities)}/3 lacunas`
    );
  }

  protected issueConcept(conceptId: string | null): string {
    if (!conceptId) return 'Módulo';
    return this.selected()?.concepts.find((c) => c.id === conceptId)?.name ?? 'Conceito';
  }
}
