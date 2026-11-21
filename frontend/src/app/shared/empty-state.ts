import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Muted, centered message with an icon, shown where a list has nothing to display. */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid justify-items-center gap-3 px-4 py-8 text-center text-[0.9rem] text-muted">
      <span aria-hidden="true" class="grid size-11 place-items-center rounded-full bg-surface-2">
        <svg
          viewBox="0 0 24 24"
          focusable="false"
          class="size-5 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:1.5]"
        >
          <path d="M4 7.5h16v12H4zM8 7.5V5h8v2.5M8 12h8m-8 3.5h5" />
        </svg>
      </span>
      <div><ng-content /></div>
    </div>
  `,
})
export class EmptyState {}
