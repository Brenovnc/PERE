import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActivityAnswer, TrueFalseActivity } from '../core/study.models';

@Component({
  selector: 'app-true-false-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="true-false-title">
      <div class="game-head">
        <h2 id="true-false-title" class="game-label">Verdadeiro ou falso</h2>
      </div>
      <p class="statement">{{ activity().payload.statement }}</p>
      <div class="choices" role="group" aria-label="Escolha verdadeiro ou falso">
        <button type="button" class="btn choice" [disabled]="disabled()" (click)="choose(true)">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M5 12.5 10 17.5 19 7" />
          </svg>
          Verdadeiro
        </button>
        <button type="button" class="btn choice" [disabled]="disabled()" (click)="choose(false)">
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6 6 18 18M18 6 6 18" />
          </svg>
          Falso
        </button>
      </div>
    </section>
  `,
  styles: `
    .statement {
      max-width: 36ch;
      margin: 0 0 2rem;
      color: var(--text-heading);
      font-family: var(--font-display);
      font-size: clamp(1.375rem, 3vw, 1.875rem);
      font-weight: 500;
      line-height: 1.4;
    }

    .choices {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }

    .choice {
      display: inline-flex;
      min-height: 4rem;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-size: 1.125rem;
      font-weight: 600;
      overflow-wrap: normal;
    }

    /* Keeps "Verdadeiro" on one line in 360px screens. */
    @media (max-width: 400px) {
      .choice {
        gap: 0.375rem;
        padding: 0.5rem;
        font-size: 1rem;
      }
    }

    .choice:hover:not(:disabled),
    .choice:focus-visible {
      border-color: var(--select);
    }

    .choice svg {
      width: 1.25rem;
      height: 1.25rem;
      flex: none;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2.25;
    }
  `,
})
export class TrueFalseGame {
  readonly activity = input.required<TrueFalseActivity>();
  readonly disabled = input(false);
  readonly answered = output<ActivityAnswer>();

  protected choose(choice: boolean): void {
    this.answered.emit({ answer: { choice }, hintsUsed: 0 });
  }
}
