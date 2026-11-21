import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ActivityAnswer, TrueFalseActivity } from '../core/study.models';

@Component({
  selector: 'app-true-false-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="true-false-title">
      <h2 id="true-false-title">Verdadeiro ou falso?</h2>
      <p>{{ activity().payload.statement }}</p>
      <div
        class="flex flex-wrap gap-[0.65rem]"
        role="group"
        aria-label="Escolha verdadeiro ou falso"
      >
        <button
          type="button"
          class="btn min-h-12 min-w-32 text-base font-bold"
          [disabled]="disabled()"
          (click)="choose(true)"
        >
          Verdadeiro
        </button>
        <button
          type="button"
          class="btn min-h-12 min-w-32 text-base font-bold"
          [disabled]="disabled()"
          (click)="choose(false)"
        >
          Falso
        </button>
      </div>
    </section>
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
