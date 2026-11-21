import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title block. Buttons placed inside the element are shown on the right as page actions. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header
      class="mb-8 flex flex-col items-start justify-between gap-6 min-[681px]:flex-row min-[681px]:items-end"
    >
      <div class="min-w-0">
        <p class="m-0 text-[0.8125rem] font-semibold text-muted">
          {{ eyebrow() }}
        </p>
        <h1 [attr.id]="titleId() ?? null" class="mt-[0.35rem] mb-0">
          {{ title() }}
        </h1>
        @if (description()) {
          <p class="mt-3 mb-0 text-base text-muted">{{ description() }}</p>
        }
      </div>
      <div class="flex w-full shrink-0 flex-wrap items-end gap-3 min-[681px]:w-auto empty:hidden">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input<string>();
  readonly titleId = input<string>();
}
