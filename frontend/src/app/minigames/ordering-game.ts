import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { ActivityAnswer, OrderingActivity, OrderingItem } from '../core/study.models';
import { HelpPopover } from '../shared/help-popover';

@Component({
  selector: 'app-ordering-game',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, HelpPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="ordering-label">
      <div class="game-head">
        <h2 id="ordering-label" class="game-label">Ordenação</h2>
        <app-help-popover>
          <p>
            Coloque os itens na ordem pedida. Arraste cada item pela alça (os seis pontos, à direita
            do texto) ou use as setas ↑ e ↓ para movê-lo. Depois, confirme a ordem.
          </p>
        </app-help-popover>
      </div>
      <p id="ordering-title" class="instruction">{{ activity().payload.instruction }}</p>
      <ol
        class="items"
        aria-labelledby="ordering-title"
        cdkDropList
        [cdkDropListData]="items()"
        [cdkDropListDisabled]="disabled()"
        (cdkDropListDropped)="drop($event)"
      >
        @for (item of items(); track item.id; let index = $index, first = $first, last = $last) {
          <li class="item" cdkDrag [cdkDragStartDelay]="startDelay">
            <span class="position" aria-hidden="true">{{ index + 1 }}</span>
            <span class="item-text">{{ item.text }}</span>
            <button
              type="button"
              class="btn btn-ghost drag-handle"
              cdkDragHandle
              [attr.aria-label]="'Arrastar ' + item.text"
              [disabled]="disabled()"
            >
              <svg aria-hidden="true" viewBox="0 0 24 16" focusable="false">
                <circle cx="6" cy="5" r="1.6" />
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="18" cy="5" r="1.6" />
                <circle cx="6" cy="11" r="1.6" />
                <circle cx="12" cy="11" r="1.6" />
                <circle cx="18" cy="11" r="1.6" />
              </svg>
            </button>
            <button
              type="button"
              class="btn btn-ghost square"
              [attr.aria-label]="'Mover ' + item.text + ' para cima'"
              [disabled]="disabled() || first"
              (click)="move(index, -1)"
            >
              <svg class="arrow" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M12 19V5M6 11l6-6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              class="btn btn-ghost square"
              [attr.aria-label]="'Mover ' + item.text + ' para baixo'"
              [disabled]="disabled() || last"
              (click)="move(index, 1)"
            >
              <svg class="arrow" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M12 5v14M6 13l6 6 6-6" />
              </svg>
            </button>
          </li>
        }
      </ol>
      <div class="game-foot">
        <button type="button" class="btn btn-primary" [disabled]="disabled()" (click)="submit()">
          Confirmar ordem
        </button>
      </div>
    </section>
  `,
  styles: `
    .instruction {
      margin: 0 0 1.5rem;
      color: var(--text-heading);
      font-family: var(--font-display);
      font-size: clamp(1.375rem, 2.6vw, 1.5rem);
      font-weight: 500;
      line-height: 1.4;
    }

    .items {
      display: grid;
      gap: 0.625rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      min-height: 3.5rem;
      align-items: center;
      gap: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 0.375rem 0.5rem;
      color: var(--text);
      background: var(--surface-2);
    }

    .position {
      display: grid;
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      place-items: center;
      border-radius: 50%;
      color: var(--text-heading);
      background: var(--surface-3);
      font-size: 0.875rem;
      font-weight: 700;
    }

    .item-text {
      flex: 1;
      min-width: 0;
      font-size: 1.0625rem;
      line-height: 1.4;
    }

    .square {
      display: grid;
      width: 2.75rem;
      min-width: 2.75rem;
      height: 2.75rem;
      flex: none;
      place-items: center;
      padding: 0;
      font-size: 1.125rem;
    }

    /* Wider than tall: easier to grab with a thumb. */
    .drag-handle {
      display: grid;
      width: 3rem;
      min-width: 3rem;
      height: 2.75rem;
      flex: none;
      place-items: center;
      padding: 0;
      color: var(--text-muted);
      touch-action: none;
      cursor: grab;
    }

    .drag-handle svg {
      width: 1.5rem;
      height: 1rem;
      fill: currentColor;
    }

    .arrow {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }

    @media (max-width: 400px) {
      .item {
        gap: 0.25rem;
      }
    }

    .drag-handle:active {
      cursor: grabbing;
    }

    /* Where the item will land while it is being dragged. */
    .item.cdk-drag-placeholder {
      border-style: dashed;
      border-color: var(--select);
      background: var(--select-soft);
      opacity: 0.7;
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
