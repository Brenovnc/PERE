import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage, isApiError } from '../../core/api-error';
import { CrosswordEntry } from '../../core/study.models';
import { STUDY_SOURCE } from '../../core/study-source';
import { CrosswordGame } from '../../minigames/crossword/crossword-game';
import { ThemeToggle } from '../../shared/theme-toggle';

@Component({
  selector: 'app-student-crossword-page',
  imports: [ThemeToggle, CrosswordGame],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main
      class="mx-auto w-[min(100%-2rem,68rem)] pt-6 pb-12 max-[480px]:w-[min(100%-1.25rem,68rem)]"
    >
      <header class="mb-6 flex items-center justify-between gap-4 max-[480px]:items-start">
        <button type="button" class="btn" (click)="back()">Voltar ao módulo</button>
        <app-theme-toggle />
      </header>
      <section class="card" aria-labelledby="crossword-title">
        @if (showGame()) {
          <app-crossword-game [entries]="entries()" (back)="back()">
            <h1 id="crossword-title" class="m-0">Cruzadinha</h1>
          </app-crossword-game>
        } @else {
          <h1 id="crossword-title">Cruzadinha</h1>
        }
        @if (loading()) {
          <p role="status">Carregando cruzadinha…</p>
        }
        @if (error()) {
          <p role="alert">{{ error() }}</p>
        }
        @if (!loading() && !error() && entries().length < 2) {
          <div class="rounded-[0.7rem] border border-[var(--game-cell-border)] bg-surface p-4">
            <p>Ainda não há palavras suficientes para montar a cruzadinha.</p>
            <p>
              {{
                allWords()
                  ? 'O professor ainda não cadastrou palavras suficientes para este módulo.'
                  : 'É preciso dominar mais conceitos que tenham palavras cadastradas para a cruzadinha.'
              }}
            </p>
            <button type="button" class="btn" (click)="back()">Voltar ao módulo</button>
          </div>
        }
      </section>
    </main>
  `,
})
export class StudentCrosswordPage implements OnInit {
  private readonly study = inject(STUDY_SOURCE);
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly moduleId = input.required<string>();
  /** Query parameter: use every word of the module, not only those of mastered concepts. */
  readonly allWords = input(false, { transform: booleanAttribute });

  protected readonly entries = signal<CrosswordEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly showGame = computed(
    () => !this.loading() && !this.error() && this.entries().length >= 2,
  );

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.entries.set(await this.study.getCrossword(this.moduleId(), this.allWords()));
    } catch (error) {
      if (!isApiError(error, 401))
        this.error.set(errorMessage(error, 'Não foi possível carregar a cruzadinha.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected back(): void {
    void this.router.navigateByUrl(`${this.study.basePath}/modules/${this.moduleId()}`);
  }
}
