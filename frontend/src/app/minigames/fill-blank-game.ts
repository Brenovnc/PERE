import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ActivityAnswer, FillBlankActivity } from '../core/study.models';
import { HelpPopover } from '../shared/help-popover';

/** Slot number → index of the option placed in it. */
type Assignment = Record<number, number>;
type DragData = { from: 'option'; index: number } | { from: 'slot'; slot: number };

/** Puts an option in a slot; an option can only be in one slot at a time. */
export function assignOption(
  assignment: Assignment,
  slot: number,
  optionIndex: number,
): Assignment {
  const next: Assignment = {};
  for (const [key, assigned] of Object.entries(assignment))
    if (assigned !== optionIndex) next[Number(key)] = assigned;
  next[slot] = optionIndex;
  return next;
}

function withoutSlot(assignment: Assignment, slot: number): Assignment {
  const next = { ...assignment };
  delete next[slot];
  return next;
}

@Component({
  selector: 'app-fill-blank-game',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, HelpPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './fill-blank-game.html',
  styleUrl: './fill-blank-game.css',
})
export class FillBlankGame {
  readonly activity = input.required<FillBlankActivity>();
  readonly disabled = input(false);
  readonly answered = output<ActivityAnswer>();

  /** On touch screens a short press starts the drag, so the page can still scroll. */
  protected readonly startDelay = { touch: 180, mouse: 0 };
  /** Empty slot the student clicked to fill next; without it, the first empty slot is the target. */
  protected readonly chosenSlot = signal<number | null>(null);
  protected readonly assignment = signal<Assignment>({});

  protected readonly parts = computed(() =>
    this.activity()
      .payload.text.split(/(\{\{\d+\}\})/g)
      .map((text) => {
        const match = /^\{\{(\d+)\}\}$/.exec(text);
        return { text, slot: match ? Number(match[1]) : null };
      }),
  );
  protected readonly activeSlot = computed(() => {
    const assignment = this.assignment();
    const chosen = this.chosenSlot();
    if (chosen !== null && assignment[chosen] === undefined) return chosen;
    const empty = this.parts().find(
      (part) => part.slot !== null && assignment[part.slot] === undefined,
    );
    return empty?.slot ?? null;
  });
  protected readonly usedOptions = computed(() => new Set(Object.values(this.assignment())));
  protected readonly filledCount = computed(
    () =>
      this.activity().payload.slotNumbers.filter((slot) => this.assignment()[slot] !== undefined)
        .length,
  );
  protected readonly complete = computed(
    () => this.filledCount() === this.activity().payload.slotNumbers.length,
  );

  protected valueAt(slot: number): string | undefined {
    const index = this.assignment()[slot];
    return index === undefined ? undefined : this.activity().payload.options[index];
  }

  /** Puts the word in the target slot; with every slot filled there is no target. */
  protected pickOption(index: number): void {
    const slot = this.activeSlot();
    if (this.disabled() || slot === null || this.usedOptions().has(index)) return;
    this.assignment.update((current) => assignOption(current, slot, index));
    this.chosenSlot.set(null);
  }

  /** A click on an empty slot makes it the target; on a filled slot it returns the word to the bank. */
  protected chooseSlot(slot: number): void {
    if (this.disabled()) return;
    if (this.assignment()[slot] === undefined) this.chosenSlot.set(slot);
    else this.assignment.update((current) => withoutSlot(current, slot));
  }

  protected dropOnSlot(event: CdkDragDrop<number, number, DragData>, target: number): void {
    if (this.disabled()) return;
    const data = event.item.data;
    if (data.from === 'option') {
      this.assignment.update((current) => assignOption(current, target, data.index));
      return;
    }
    // A filled slot dragged and released outside any slot loses its word.
    if (event.container === event.previousContainer) {
      if (!event.isPointerOverContainer)
        this.assignment.update((current) => withoutSlot(current, data.slot));
      return;
    }
    const option = this.assignment()[data.slot];
    if (option !== undefined)
      this.assignment.update((current) => assignOption(current, target, option));
  }

  protected dropOnOptions(event: CdkDragDrop<null, unknown, DragData>): void {
    const data = event.item.data;
    if (!this.disabled() && data.from === 'slot')
      this.assignment.update((current) => withoutSlot(current, data.slot));
  }

  protected submit(): void {
    const { slotNumbers, options } = this.activity().payload;
    const answers = [...slotNumbers]
      .sort((a, b) => a - b)
      .map((slotNumber) => ({ slotNumber, text: options[this.assignment()[slotNumber]] }));
    this.answered.emit({ answer: { answers }, hintsUsed: 0 });
  }
}
