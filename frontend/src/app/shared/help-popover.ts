import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

let nextId = 0;

/** "?" (or "i") button that opens a small help text next to a minigame or section. Esc or a click outside closes it. */
@Component({
  selector: 'app-help-popover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'relative inline-block shrink-0',
    '(document:pointerdown)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeOnEscape()',
  },
  template: `
    <button
      #button
      type="button"
      class="help-button"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      (click)="open.set(!open())"
    >
      {{ icon() }}
    </button>
    @if (open()) {
      <div [id]="panelId" class="help-panel [&>p]:my-0 [&>p+p]:mt-2">
        <ng-content />
      </div>
    }
  `,
  styles: `
    .help-button {
      position: relative;
      display: inline-grid;
      width: 2.25rem;
      height: 2.25rem;
      place-items: center;
      padding: 0;
      border: 1px solid var(--btn-secondary-border);
      border-radius: 50%;
      color: var(--text);
      background: var(--btn-secondary-bg);
      font: inherit;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
    }

    /* Keeps the touch target at 44px while the circle stays small. */
    .help-button::before {
      position: absolute;
      inset: -0.25rem;
      content: '';
    }

    .help-button:hover,
    .help-button[aria-expanded='true'] {
      background: var(--surface-3);
    }

    .help-panel {
      position: absolute;
      z-index: 30;
      top: calc(100% + 0.5rem);
      right: 0;
      width: min(20rem, calc(100vw - 4rem));
      padding: 0.875rem 1rem;
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      color: var(--text);
      background: var(--surface-1);
      box-shadow: 0 0.5rem 1.5rem var(--shadow);
      font-size: 0.9375rem;
      line-height: 1.5;
      text-align: left;
    }
  `,
})
export class HelpPopover {
  readonly icon = input<'?' | 'i'>('?');
  readonly label = input('Como jogar');

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  protected readonly panelId = `help-popover-${nextId++}`;
  protected readonly open = signal(false);

  protected closeOnOutsideClick(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node))
      this.open.set(false);
  }

  protected closeOnEscape(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.button().nativeElement.focus();
  }
}
