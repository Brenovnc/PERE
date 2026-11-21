import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';

export interface ChartTab {
  id: string;
  label: string;
  summary?: string;
}

let nextId = 0;

/** Card with one tab per chart; the page projects the chart of the selected tab. */
@Component({
  selector: 'app-chart-tabs-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section
      class="mb-4 min-w-0 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
    >
      <div
        class="flex gap-[0.35rem] overflow-x-auto border-b border-border p-[0.65rem] max-[600px]:gap-[0.2rem]"
        role="tablist"
        [attr.aria-label]="label()"
      >
        @for (tab of tabs(); track tab.id; let index = $index) {
          <button
            #tabButton
            type="button"
            role="tab"
            class="min-h-[2.7rem] shrink-0 cursor-pointer rounded-lg border border-transparent bg-transparent px-[0.8rem] py-[0.55rem] text-text hover:bg-surface-2 focus-visible:outline-offset-[-3px] aria-selected:border-border aria-selected:bg-surface-3 aria-selected:text-heading max-[600px]:px-[0.65rem] max-[600px]:py-2 max-[600px]:text-[0.88rem]"
            [id]="prefix + '-tab-' + tab.id"
            [attr.aria-selected]="active().id === tab.id"
            [attr.aria-controls]="prefix + '-panel'"
            [tabIndex]="active().id === tab.id ? 0 : -1"
            (click)="activeId.set(tab.id)"
            (keydown)="onKeydown($event, index)"
          >
            {{ tab.label }}
          </button>
        }
      </div>
      <div
        role="tabpanel"
        tabindex="0"
        class="overflow-auto p-[clamp(1rem,2vw,1.5rem)] focus-visible:outline-offset-[-3px]"
        [id]="prefix + '-panel'"
        [attr.aria-labelledby]="prefix + '-tab-' + active().id"
      >
        @if (loading()) {
          <p role="status">Carregando gráfico…</p>
        } @else if (empty()) {
          <p
            class="m-0 grid min-h-[clamp(19rem,50vh,36rem)] place-items-center text-center text-muted"
          >
            {{ emptyMessage() }}
          </p>
        } @else {
          <div class="min-w-0"><ng-content /></div>
          @if (active().summary) {
            <p class="mt-[0.6rem] mb-0 text-[0.9rem] leading-[1.45] text-muted" aria-live="polite">
              {{ active().summary }}
            </p>
          }
        }
      </div>
    </section>
  `,
})
export class ChartTabsCard {
  readonly tabs = input.required<ChartTab[]>();
  readonly activeId = model.required<string>();
  readonly label = input.required<string>();
  readonly loading = input(false);
  readonly empty = input(false);
  readonly emptyMessage = input('Ainda não há dados para exibir.');

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');
  protected readonly prefix = `chart-${nextId++}`;
  protected readonly active = computed(
    () => this.tabs().find((tab) => tab.id === this.activeId()) ?? this.tabs()[0],
  );

  /** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern). */
  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % count
        : event.key === 'ArrowLeft'
          ? (index - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    this.activeId.set(this.tabs()[next].id);
    this.buttons()[next]?.nativeElement.focus();
  }
}
