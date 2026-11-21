import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ActivityAnswer, ExposureActivity } from '../core/study.models';
import { HelpPopover } from '../shared/help-popover';

type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'revealed'; text: string }
  | { kind: 'next' | 'hidden'; keywordNumber: number };

@Component({
  selector: 'app-exposure-game',
  imports: [HelpPopover],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="exposure-title">
      <div class="game-head">
        <h2 id="exposure-title" class="game-label">Leitura</h2>
        <app-help-popover>
          <p>
            Leia o texto. As palavras-chave estão ocultas: revele uma de cada vez, clicando na
            próxima palavra destacada ou no botão abaixo. Depois de revelar todas, conclua a
            leitura.
          </p>
        </app-help-popover>
      </div>
      <p class="reading">
        @for (piece of pieces(); track $index) {
          @switch (piece.kind) {
            @case ('text') {
              <span>{{ piece.text }}</span>
            }
            @case ('revealed') {
              <mark>{{ piece.text }}</mark>
            }
            @case ('next') {
              <button
                type="button"
                class="keyword keyword-next"
                [disabled]="disabled()"
                [attr.aria-label]="'Revelar palavra-chave ' + piece.keywordNumber"
                (click)="reveal.emit()"
              >
                ?
              </button>
            }
            @case ('hidden') {
              <span
                class="keyword"
                [attr.aria-label]="'Palavra-chave ' + piece.keywordNumber + ' oculta'"
                >?</span
              >
            }
          }
        }
      </p>
      <div class="game-foot">
        <div class="mr-auto flex flex-wrap items-center gap-3">
          <span class="flex flex-wrap gap-1.5" aria-hidden="true">
            @for (dot of dots(); track $index) {
              <span class="dot" [class.dot-filled]="dot"></span>
            }
          </span>
          <p class="m-0 text-[0.875rem] text-muted" aria-live="polite">
            {{ revealedCount() }} de {{ activity().payload.keywordCount }} reveladas
          </p>
        </div>
        @if (!complete()) {
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="disabled()"
            (click)="reveal.emit()"
          >
            Revelar próxima palavra
          </button>
        } @else {
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="disabled()"
            (click)="answered.emit({ answer: { completed: true }, hintsUsed: 0 })"
          >
            Concluir leitura
          </button>
        }
      </div>
    </section>
  `,
  styles: `
    .reading {
      margin: 0;
      color: var(--text-heading);
      font-family: var(--font-display);
      font-size: clamp(1.25rem, 2.4vw, 1.375rem);
      line-height: 1.9;
      overflow-wrap: anywhere;
    }

    mark {
      border-radius: 0.3rem;
      padding: 0 0.25rem;
      color: var(--text-heading);
      background: var(--accent-soft);
    }

    .keyword {
      display: inline-block;
      min-width: 3.5rem;
      margin: 0 0.15rem;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 0 0.75rem;
      color: var(--text-muted);
      background: var(--surface-3);
      font: inherit;
      line-height: 1.6;
      text-align: center;
      vertical-align: baseline;
    }

    .keyword-next {
      border-color: var(--select);
      color: var(--text-heading);
      background: var(--select-soft);
      font-weight: 600;
      cursor: pointer;
    }

    .keyword-next:disabled {
      cursor: wait;
    }

    .dot {
      width: 0.625rem;
      height: 0.625rem;
      border: 1px solid var(--border-strong);
      border-radius: 50%;
    }

    .dot-filled {
      border-color: var(--accent);
      background: var(--accent);
    }
  `,
})
export class ExposureGame {
  readonly activity = input.required<ExposureActivity>();
  readonly disabled = input(false);
  readonly reveal = output();
  readonly answered = output<ActivityAnswer>();

  protected readonly revealedCount = computed(() => {
    const payload = this.activity().payload;
    return payload.revealedCount ?? payload.revealedKeywords.length;
  });
  protected readonly complete = computed(
    () => this.revealedCount() >= this.activity().payload.keywordCount,
  );
  /** One dot per keyword, filled once it is revealed. */
  protected readonly dots = computed(() =>
    Array.from(
      { length: this.activity().payload.keywordCount },
      (_, index) => index < this.revealedCount(),
    ),
  );

  /** Only the first hidden keyword after the revealed ones is clickable. */
  protected readonly pieces = computed<Piece[]>(() => {
    const { segments, revealedKeywords } = this.activity().payload;
    let nextRendered = false;
    return segments.map((segment) => {
      if (segment.keywordIndex === null) return { kind: 'text', text: segment.text ?? '' };
      const keyword = revealedKeywords[segment.keywordIndex];
      if (keyword !== undefined) return { kind: 'revealed', text: keyword };
      const keywordNumber = segment.keywordIndex + 1;
      if (segment.keywordIndex === this.revealedCount() && !nextRendered) {
        nextRendered = true;
        return { kind: 'next', keywordNumber };
      }
      return { kind: 'hidden', keywordNumber };
    });
  });
}
