import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ActivityAnswer, GuessConceptActivity } from '../core/study.models';

@Component({
  selector: 'app-guess-concept-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="guess-title">
      <div class="game-head">
        <h2 id="guess-title" class="game-label">Qual é o conceito?</h2>
      </div>
      <ol class="clues" aria-label="Pistas">
        @for (clue of activity().payload.clues; track $index) {
          <li class="clue">
            <span class="clue-number" aria-hidden="true">{{ $index + 1 }}</span>
            <p class="clue-text">
              <span class="sr-only">Pista {{ $index + 1 }}: </span>{{ clue }}
            </p>
          </li>
        }
        @for (number of pendingClues(); track number; let first = $first) {
          <li class="clue clue-pending">
            <span class="text-muted">Pista {{ number }}</span>
            @if (first) {
              <button type="button" class="btn" [disabled]="disabled()" (click)="reveal.emit()">
                Revelar próxima pista
              </button>
            }
          </li>
        }
      </ol>
      @if (pendingClues().length) {
        <p class="mt-3 mb-0 text-[0.875rem] text-muted">Cada pista extra conta como ajuda.</p>
      }
      <form class="mt-7" (submit)="submit($event)">
        <label for="guess-answer" class="mb-2 block text-[0.875rem] font-semibold text-muted">
          Sua resposta
        </label>
        <div class="answer-row">
          <input
            id="guess-answer"
            class="field answer-input"
            autocomplete="off"
            #answerInput
            [value]="answer()"
            [disabled]="disabled()"
            (input)="answer.set(answerInput.value)"
          />
          <button type="submit" class="btn btn-primary" [disabled]="disabled() || !answer().trim()">
            Enviar resposta
          </button>
        </div>
      </form>
    </section>
  `,
  styles: `
    .clues {
      display: grid;
      gap: 0.75rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .clue {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      border-radius: 0.75rem;
      padding: 1rem;
      background: var(--surface-2);
    }

    .clue-number {
      display: grid;
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      place-items: center;
      border-radius: 50%;
      color: var(--accent-contrast);
      background: var(--accent);
      font-size: 0.875rem;
      font-weight: 700;
    }

    .clue-text {
      margin: 0;
      padding-top: 0.05rem;
      color: var(--text-heading);
      font-size: 1.125rem;
      line-height: 1.5;
    }

    .clue-pending {
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      border: 1px dashed var(--border-strong);
      background: transparent;
    }

    .answer-row {
      display: flex;
      gap: 0.75rem;
    }

    .answer-input {
      flex: 1;
      height: 3rem;
      font-size: 1.125rem;
    }

    @media (max-width: 560px) {
      .answer-row {
        flex-direction: column;
      }
    }
  `,
})
export class GuessConceptGame {
  readonly activity = input.required<GuessConceptActivity>();
  readonly disabled = input(false);
  readonly reveal = output();
  readonly answered = output<ActivityAnswer>();

  protected readonly answer = signal('');
  /** Numbers of the clues not revealed yet. */
  protected readonly pendingClues = computed(() => {
    const { clueCount, clues } = this.activity().payload;
    return Array.from(
      { length: Math.max(0, clueCount - clues.length) },
      (_, i) => clues.length + i + 1,
    );
  });

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.answer().trim() || this.disabled()) return;
    // The first clue is free; each extra clue counts as a hint.
    const hintsUsed = Math.max(0, this.activity().payload.clues.length - 1);
    this.answered.emit({ answer: { text: this.answer() }, hintsUsed });
  }
}
