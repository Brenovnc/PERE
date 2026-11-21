import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ActivityAnswer, GuessConceptActivity } from '../core/study.models';

@Component({
  selector: 'app-guess-concept-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="guess-title">
      <h2 id="guess-title">Qual é o conceito?</h2>
      <ol class="grid gap-[0.8rem] pl-6" aria-label="Pistas reveladas">
        @for (clue of activity().payload.clues; track $index) {
          <li>
            <strong>Pista {{ $index + 1 }}:</strong> {{ clue }}
          </li>
        }
      </ol>
      @if (activity().payload.clues.length < activity().payload.clueCount) {
        <button type="button" class="btn" [disabled]="disabled()" (click)="reveal.emit()">
          Revelar próxima pista
        </button>
      }
      <form (submit)="submit($event)">
        <label class="my-4 grid gap-[0.4rem]">
          Sua resposta
          <input
            class="w-full max-w-lg p-[0.7rem] [font:inherit]"
            aria-label="Sua resposta"
            autocomplete="off"
            #answerInput
            [value]="answer()"
            [disabled]="disabled()"
            (input)="answer.set(answerInput.value)"
          />
        </label>
        <button type="submit" class="btn" [disabled]="disabled() || !answer().trim()">
          Enviar resposta
        </button>
      </form>
    </section>
  `,
})
export class GuessConceptGame {
  readonly activity = input.required<GuessConceptActivity>();
  readonly disabled = input(false);
  readonly reveal = output();
  readonly answered = output<ActivityAnswer>();

  protected readonly answer = signal('');

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.answer().trim() || this.disabled()) return;
    // The first clue is free; each extra clue counts as a hint.
    const hintsUsed = Math.max(0, this.activity().payload.clues.length - 1);
    this.answered.emit({ answer: { text: this.answer() }, hintsUsed });
  }
}
