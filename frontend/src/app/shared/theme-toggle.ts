import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border border-border-strong bg-surface p-0 leading-none text-accent hover:bg-surface-2 active:bg-accent-soft"
      [attr.aria-label]="label()"
      [attr.aria-pressed]="isLight()"
      (click)="theme.toggle()"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        focusable="false"
        class="block size-5 overflow-visible fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.7]"
      >
        @if (isLight()) {
          <path d="M20.5 15.5A8.5 8.5 0 0 1 8.5 3.5 8.5 8.5 0 1 0 20.5 15.5Z" />
        } @else {
          <circle cx="12" cy="12" r="3.5" />
          <path
            d="M12 3v2m0 14v2M5.6 5.6 7 7m10 10 1.4 1.4M3 12h2m14 0h2M5.6 18.4 7 17m10-10 1.4-1.4"
          />
        }
      </svg>
    </button>
  `,
})
export class ThemeToggle {
  protected readonly theme = inject(ThemeService);
  protected readonly isLight = computed(() => this.theme.theme() === 'light');
  protected readonly label = computed(() =>
    this.isLight() ? 'Ativar modo escuro' : 'Ativar modo claro',
  );
}
