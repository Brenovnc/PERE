import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { ModuleDetails } from '../../../core/teacher.models';
import { EmptyState } from '../../../shared/empty-state';
import { HelpPopover } from '../../../shared/help-popover';
import { blankConcept, ConceptDraft, lines } from './concept-draft';

type ListKey = 'recognitionActivities' | 'fillBlankActivities' | 'orderingActivities';

/** Form for one concept: basics, keywords, clues, prerequisites, activities and crossword word. */
@Component({
  selector: 'app-concept-editor',
  imports: [EmptyState, HelpPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concept-editor.html',
  styleUrl: './modules.css',
})
export class ConceptEditor {
  readonly module = input.required<ModuleDetails>();
  readonly value = model.required<ConceptDraft>();
  readonly busy = input(false);
  readonly saved = output();
  readonly duplicate = output();
  readonly deactivate = output();

  private readonly sections = viewChildren<ElementRef<HTMLDetailsElement>>('section');
  protected readonly allOpen = signal(false);

  /** Other active concepts that can be prerequisites. */
  protected readonly otherConcepts = computed(() =>
    this.module().concepts.filter((c) => c.isActive && c.id !== this.value().id),
  );
  protected readonly keywordCount = computed(() => lines(this.value().keywords).length);
  protected readonly clueCount = computed(() => lines(this.value().clues).length);

  protected toggleAll(): void {
    const open = !this.allOpen();
    for (const section of this.sections()) section.nativeElement.open = open;
    this.allOpen.set(open);
  }

  /** Keeps the "Expandir tudo" label right when the teacher opens or closes a section by hand. */
  protected syncOpen(): void {
    this.allOpen.set(this.sections().every((section) => section.nativeElement.open));
  }

  protected patch(partial: Partial<ConceptDraft>): void {
    this.value.update((current) => ({ ...current, ...partial }));
  }

  protected togglePrerequisite(id: string, checked: boolean): void {
    const ids = this.value().prerequisiteIds;
    this.patch({ prerequisiteIds: checked ? [...ids, id] : ids.filter((item) => item !== id) });
  }

  /** Changes one field of one activity in a list. */
  protected patchItem<K extends ListKey>(
    key: K,
    index: number,
    partial: Partial<ConceptDraft[K][number]>,
  ): void {
    this.value.update((current) => ({
      ...current,
      [key]: current[key].map((item, i) => (i === index ? { ...item, ...partial } : item)),
    }));
  }

  protected removeItem(key: ListKey, index: number): void {
    this.value.update((current) => ({
      ...current,
      [key]: current[key].filter((_, i) => i !== index),
    }));
  }

  protected addTrueFalse(): void {
    this.patch({
      recognitionActivities: [
        ...this.value().recognitionActivities,
        { statement: '', isCorrect: false, explanation: '' },
      ],
    });
  }

  protected addFillBlank(): void {
    this.patch({
      fillBlankActivities: [
        ...this.value().fillBlankActivities,
        { text: '', answers: '', distractors: '' },
      ],
    });
  }

  protected addOrdering(): void {
    this.patch({
      orderingActivities: [...this.value().orderingActivities, { instruction: '', items: '' }],
    });
  }

  protected clear(): void {
    this.value.set(blankConcept());
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    this.saved.emit();
  }

  protected completeness(count: number): string {
    return count >= 3 ? '✓ completo' : '⚠ incompleto';
  }
}
