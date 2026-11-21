import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';

/** Time spent on the current activity, as mm:ss. */
@Component({
  selector: 'app-session-timer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p
      class="m-0 text-[1.1rem] text-accent tabular-nums"
      [attr.aria-label]="'Tempo nesta atividade: ' + elapsed()"
    >
      <span aria-hidden="true">{{ elapsed() }}</span>
    </p>
  `,
})
export class SessionTimer {
  readonly startedAtUtc = input.required<string>();

  private readonly now = signal(Date.now());
  protected readonly elapsed = computed(() => {
    const seconds = Math.max(0, Math.floor((this.now() - Date.parse(this.startedAtUtc())) / 1000));
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  });

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
