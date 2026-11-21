import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ActivityAnswer, ExposureActivity } from '../core/study.models';

type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'revealed'; text: string }
  | { kind: 'next' | 'hidden'; keywordNumber: number };

@Component({
  selector: 'app-exposure-game',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="exposure-title">
      <h2 id="exposure-title">Leia e explore</h2>
      <p class="text-[1.2rem] leading-[2.4] [overflow-wrap:anywhere]">
        @for (piece of pieces(); track $index) {
          @switch (piece.kind) {
            @case ('text') {
              <span>{{ piece.text }}</span>
            }
            @case ('revealed') {
              <mark class="rounded-[0.25rem] bg-surface-2 px-[0.2rem] text-text">{{
                piece.text
              }}</mark>
            }
            @case ('next') {
              <button
                type="button"
                class="hidden-keyword cursor-pointer"
                [disabled]="disabled()"
                [attr.aria-label]="'Revelar palavra-chave ' + piece.keywordNumber"
                (click)="reveal.emit()"
              >
                ????
              </button>
            }
            @case ('hidden') {
              <span
                class="hidden-keyword"
                [attr.aria-label]="'Palavra-chave ' + piece.keywordNumber + ' oculta'"
                >????</span
              >
            }
          }
        }
      </p>
      <p aria-live="polite">
        {{ revealedCount() }} de {{ activity().payload.keywordCount }} palavras-chave reveladas
      </p>
      <div class="flex flex-wrap gap-3">
        @if (!complete()) {
          <button type="button" class="btn" [disabled]="disabled()" (click)="reveal.emit()">
            Revelar próxima palavra
          </button>
        }
        <button
          type="button"
          class="btn"
          [disabled]="disabled() || !complete()"
          (click)="answered.emit({ answer: { completed: true }, hintsUsed: 0 })"
        >
          Concluir exposição
        </button>
      </div>
    </section>
  `,
  styles: `
    .hidden-keyword {
      display: inline-block;
      min-width: 4.5rem;
      margin: 0 0.2rem;
      border: 1px dashed var(--border);
      border-radius: 0.4rem;
      padding: 0.15rem 0.5rem;
      color: var(--text);
      background: var(--surface-2);
      font: inherit;
      text-align: center;
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
