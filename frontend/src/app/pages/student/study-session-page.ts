import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { errorMessage, isApiError } from '../../core/api-error';
import {
  ActivityAnswer,
  AnswerResponse,
  StudentModule,
  StudyActivity,
  StudySession,
} from '../../core/study.models';
import { STUDY_SOURCE } from '../../core/study-source';
import { ActivityGame } from '../../minigames/activity-game';
import { EmptyState } from '../../shared/empty-state';
import { reviewLabel } from '../../shared/review-date';
import { SessionTimer } from '../../shared/session-timer';
import { ThemeToggle } from '../../shared/theme-toggle';

/** Mirrors the backend limit (and sessionLength in the visitor engine): at most 10 activities per session. */
const SESSION_LENGTH = 10;

interface Feedback {
  response: AnswerResponse;
  activity: StudyActivity;
  /** Expected answer shown when the student got it wrong. */
  expected: string;
  explanation: string;
}

function readableError(error: unknown): string {
  if (isApiError(error, 403)) return 'Esta área está disponível apenas para alunos autorizados.';
  if (isApiError(error, 404)) return 'A sessão ou o módulo não foi encontrado.';
  if (isApiError(error, 409)) return 'A sessão mudou. Atualize para continuar.';
  return errorMessage(error, 'Não foi possível comunicar com o servidor.');
}

/** Turns the correctAnswer sent by the API into readable text for each activity type. */
function describeCorrectAnswer(
  activity: StudyActivity,
  answer: unknown,
): { expected: string; explanation: string } {
  if (!answer || typeof answer !== 'object') return { expected: '', explanation: '' };
  const value = answer as Record<string, unknown>;
  let expected = '';
  if (activity.type === 'TRUE_FALSE' && typeof value['choice'] === 'boolean')
    expected = value['choice'] ? 'Verdadeiro' : 'Falso';
  else if (activity.type === 'GUESS_CONCEPT' && typeof value['text'] === 'string')
    expected = value['text'];
  else if (activity.type === 'FILL_BLANK' && Array.isArray(value['answers']))
    expected = (value['answers'] as { text?: unknown }[])
      .map((item) => (item && typeof item.text === 'string' ? item.text : ''))
      .filter(Boolean)
      .join(' · ');
  else if (activity.type === 'ORDERING' && Array.isArray(value['itemIds'])) {
    const byId = new Map(activity.payload.items.map((item) => [item.id, item.text]));
    expected = (value['itemIds'] as unknown[])
      .map((id) => byId.get(String(id)))
      .filter(Boolean)
      .join(' → ');
  }
  const explanation = typeof value['explanation'] === 'string' ? value['explanation'] : '';
  return { expected, explanation };
}

@Component({
  selector: 'app-study-session-page',
  imports: [ThemeToggle, SessionTimer, ActivityGame, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './study-session-page.html',
})
export class StudySessionPage implements OnInit {
  private readonly study = inject(STUDY_SOURCE);
  protected readonly base = this.study.basePath;
  private readonly router = inject(Router);

  /** Route parameter. */
  readonly sessionId = input.required<string>();

  protected readonly session = signal<StudySession | null>(null);
  protected readonly finalModule = signal<StudentModule | null>(null);
  protected readonly feedback = signal<Feedback | null>(null);
  protected readonly busy = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly reviewLabel = reviewLabel;
  protected readonly sessionLength = SESSION_LENGTH;
  protected readonly segments = Array.from({ length: SESSION_LENGTH }, (_, index) => index);

  /**
   * The backend raises totalActivities as activities are shown, so the bar always counts to the
   * session limit. While the feedback is open, the answered activity is already counted as done.
   */
  protected readonly progress = computed(() => {
    const session = this.session();
    const done = Math.min(session?.completedActivities ?? 0, SESSION_LENGTH);
    const inProgress = !!session?.activity && !this.feedback() && done < SESSION_LENGTH;
    const number = inProgress ? done + 1 : done;
    return {
      done,
      current: inProgress ? done : -1,
      label: number > 0 ? `Atividade ${number} de ${SESSION_LENGTH}` : `0 de ${SESSION_LENGTH}`,
    };
  });

  private readonly continueButton = viewChild<ElementRef<HTMLButtonElement>>('continueButton');

  constructor() {
    // Moves the focus to "Continuar" when the feedback appears, so Enter goes on.
    afterRenderEffect(() => {
      const button = this.continueButton()?.nativeElement;
      if (button && !this.busy()) button.focus();
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.session.set(await this.study.getSession(this.sessionId()));
      void this.loadSummaryIfCompleted();
    } catch (error) {
      if (!isApiError(error, 401)) this.error.set(readableError(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** After a normal session, shows the updated module progress. */
  private async loadSummaryIfCompleted(): Promise<void> {
    const session = this.session();
    if (session?.status !== 'COMPLETED' || session.mode === 'FREE_PRACTICE') return;
    try {
      this.finalModule.set(await this.study.getModule(session.moduleId));
    } catch {
      this.notice.set(
        'A sessão foi salva; o resumo atualizado estará disponível ao voltar ao módulo.',
      );
    }
  }

  private async refresh(): Promise<StudySession> {
    const session = await this.study.getSession(this.sessionId());
    this.session.set(session);
    return session;
  }

  /** Runs one request at a time and handles the errors shared by every action. */
  private async run(action: () => Promise<void>, conflictMessage: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await action();
    } catch (error) {
      if (isApiError(error, 401)) return;
      if (isApiError(error, 409)) await this.recoverConflict(conflictMessage);
      else this.error.set(readableError(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async recoverConflict(message: string): Promise<void> {
    try {
      const current = await this.refresh();
      this.feedback.set(null);
      this.notice.set(current.status === 'COMPLETED' ? 'A sessão já foi concluída.' : message);
      void this.loadSummaryIfCompleted();
    } catch (error) {
      this.error.set(readableError(error));
    }
  }

  protected reveal(): void {
    const activity = this.session()?.activity;
    if (!activity) return;
    void this.run(async () => {
      await this.study.reveal(this.sessionId(), activity.presentationId);
      await this.refresh();
    }, 'A atividade foi atualizada. Confira o estado atual e tente novamente se necessário.');
  }

  protected submit({ answer, hintsUsed }: ActivityAnswer): void {
    const activity = this.session()?.activity;
    if (!activity || this.feedback()) return;
    this.notice.set('');
    void this.run(async () => {
      const response = await this.study.submit(this.sessionId(), activity, answer, hintsUsed);
      this.session.update((current) =>
        current
          ? {
              ...current,
              completedActivities: response.completedActivities,
              totalActivities: response.totalActivities,
            }
          : current,
      );
      const described = response.wasCorrect
        ? { expected: '', explanation: '' }
        : describeCorrectAnswer(activity, response.correctAnswer);
      this.feedback.set({ response, activity, ...described });
    }, 'Esta resposta já foi processada ou a atividade mudou. A sessão foi atualizada.');
  }

  protected continueAfterFeedback(): void {
    const feedback = this.feedback();
    if (!feedback) return;
    const { response } = feedback;
    this.feedback.set(null);
    this.notice.set('');
    if (response.sessionStatus === 'COMPLETED') {
      this.session.update((current) =>
        current ? { ...current, status: 'COMPLETED', activity: null } : current,
      );
      void this.loadSummaryIfCompleted();
    } else if (response.nextActivity) {
      const nextActivity = response.nextActivity;
      this.session.update((current) =>
        current ? { ...current, status: 'ACTIVE', activity: nextActivity } : current,
      );
    } else {
      this.refresh().catch((error: unknown) => this.error.set(readableError(error)));
    }
  }

  protected abandon(): void {
    if (!window.confirm('Deseja abandonar esta sessão? Suas respostas já enviadas serão mantidas.'))
      return;
    void this.run(async () => {
      await this.study.abandon(this.sessionId());
      await this.router.navigateByUrl(this.study.basePath);
    }, 'A sessão já mudou de estado. O estado atual foi carregado.');
  }

  protected goTo(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
