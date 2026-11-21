import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { ModuleInput } from '../../../core/teacher.models';

/** Title, subject, description, version and student features of a module (used to create and edit). */
@Component({
  selector: 'app-module-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  styleUrl: './modules.css',
  template: `
    <label
      >Título<input
        #title
        required
        maxlength="160"
        [value]="value().title"
        (input)="patch({ title: title.value })"
    /></label>
    <label
      >Disciplina<input
        #subject
        required
        maxlength="120"
        [value]="value().subject"
        (input)="patch({ subject: subject.value })"
    /></label>
    <label class="wide"
      >Descrição<textarea
        #description
        rows="3"
        maxlength="4000"
        [value]="value().description"
        (input)="patch({ description: description.value })"
      ></textarea>
    </label>
    <label
      >Versão<input
        #version
        type="number"
        min="1"
        required
        [value]="value().version"
        (input)="patch({ version: version.valueAsNumber })"
    /></label>
    <section class="feature-card" aria-labelledby="module-features-title">
      <h3 id="module-features-title">Recursos para o aluno</h3>
      <label class="feature-row">
        <span>
          <strong>Cruzadinha</strong>
          <small
            >Jogo alternativo de estudo montado com as palavras cadastradas nos conceitos.</small
          >
        </span>
        <input
          #crossword
          type="checkbox"
          role="switch"
          [checked]="value().crosswordEnabled"
          (change)="setCrossword(crossword.checked)"
        />
      </label>
      <label class="feature-row" [attr.data-disabled]="!value().crosswordEnabled">
        <span>
          <strong>Usar todas as palavras</strong>
          <small
            >O aluno pode alternar entre usar só conceitos dominados ou todas as palavras do
            módulo.</small
          >
        </span>
        <input
          #allWords
          type="checkbox"
          role="switch"
          [checked]="value().crosswordAllowAllWords"
          [disabled]="!value().crosswordEnabled"
          (change)="patch({ crosswordAllowAllWords: allWords.checked })"
        />
      </label>
    </section>
  `,
})
export class ModuleFields {
  readonly value = model.required<ModuleInput>();

  protected patch(partial: Partial<ModuleInput>): void {
    this.value.update((current) => ({ ...current, ...partial }));
  }

  /** Turning the crossword off also turns off "all words". */
  protected setCrossword(enabled: boolean): void {
    this.patch({
      crosswordEnabled: enabled,
      crosswordAllowAllWords: enabled && this.value().crosswordAllowAllWords,
    });
  }
}
