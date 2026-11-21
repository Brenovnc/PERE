import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { ActivityAnswer, OrderingActivity, OrderingItem } from '../core/study.models';

@Component({
  selector: 'app-ordering-game',
  imports: [CdkDropList, CdkDrag, CdkDragHandle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="ordering-title">
      <h2 id="ordering-title">{{ activity().payload.instruction }}</h2>
      <ol
        class="items"
        cdkDropList
        [cdkDropListData]="items()"
        [cdkDropListDisabled]="disabled()"
        (cdkDropListDropped)="drop($event)"
      >
        @for (item of items(); track item.id; let index = $index, first = $first, last = $last) {
          <li class="item" cdkDrag [cdkDragStartDelay]="startDelay">
            <span>{{ item.text }}</span>
            <div class="controls">
              <button
                type="button"
                class="btn drag-handle"
                cdkDragHandle
                [attr.aria-label]="'Arrastar ' + item.text"
                [disabled]="disabled()"
              >
                ⠿
              </button>
              <button
                type="button"
                class="btn"
                [attr.aria-label]="'Mover ' + item.text + ' para cima'"
                [disabled]="disabled() || first"
                (click)="move(index, -1)"
              >
                ↑
              </button>
              <button
                type="button"
                class="btn"
                [attr.aria-label]="'Mover ' + item.text + ' para baixo'"
                [disabled]="disabled() || last"
                (click)="move(index, 1)"
              >
                ↓
              </button>
            </div>
          </li>
        }
      </ol>
      <button type="button" class="btn" [disabled]="disabled()" (click)="submit()">
        Enviar sequência
      </button>
    </section>
  `,
  styles: `
    .items {
      display: grid;
      gap: 0.6rem;
      padding-left: 1.8rem;
    }

    .item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 0.65rem;
      background: var(--surface);
    }

    .controls {
      display: flex;
      gap: 0.4rem;
    }

    .controls .btn {
      min-width: 2.75rem;
      padding: 0.6rem 0.4rem;
    }

    .drag-handle {
      border-style: dashed;
      touch-action: none;
      cursor: grab;
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    /* Where the item will land while it is being dragged. */
    .item.cdk-drag-placeholder {
      background: var(--accent-soft);
      opacity: 0.6;
    }

    .item.cdk-drag-preview {
      box-shadow: 0 0.75rem 1.5rem var(--shadow);
      color: var(--text);
      list-style: none;
    }

    .items.cdk-drop-list-dragging .item:not(.cdk-drag-placeholder) {
      transition: transform 0.2s ease;
    }
  `,
})
export class OrderingGame {
  readonly activity = input.required<OrderingActivity>();
  readonly disabled = input(false);
  readonly answered = output<ActivityAnswer>();

  protected readonly startDelay = { touch: 180, mouse: 0 };
  protected readonly items = linkedSignal<OrderingItem[]>(() => this.activity().payload.items);

  protected drop(event: CdkDragDrop<OrderingItem[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    this.items.update((current) => {
      const next = [...current];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
  }

  protected move(index: number, direction: -1 | 1): void {
    this.items.update((current) => {
      const next = [...current];
      moveItemInArray(next, index, index + direction);
      return next;
    });
  }

  protected submit(): void {
    this.answered.emit({ answer: { itemIds: this.items().map((item) => item.id) }, hintsUsed: 0 });
  }
}
