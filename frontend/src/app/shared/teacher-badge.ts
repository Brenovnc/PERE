import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Shows who is responsible for a module: initial in a circle, name and institution. */
@Component({
  selector: 'app-teacher-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex min-w-0 shrink-0 items-center gap-[0.7rem] rounded-xl px-3 py-[0.6rem]"
      [class]="
        onPage()
          ? 'bg-surface-2 [:root[data-theme=light]_&]:border [:root[data-theme=light]_&]:border-border [:root[data-theme=light]_&]:bg-surface-1'
          : 'bg-surface-2'
      "
    >
      <span
        aria-hidden="true"
        class="grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-bold text-text"
        [style.width.px]="size()"
        [style.height.px]="size()"
        [style.font-size.px]="fontSize()"
      >
        {{ initial() }}
      </span>
      <span class="grid min-w-0 gap-[0.15rem]">
        <small class="text-[0.78rem] text-muted">Professor(a) responsável</small>
        <strong class="text-[0.9rem] [overflow-wrap:anywhere]">{{ displayName() }}</strong>
        @if (institution()?.trim()) {
          <span class="text-[0.78rem] text-muted">{{ institution() }}</span>
        }
      </span>
    </div>
  `,
})
export class TeacherBadge {
  readonly name = input<string | null>(null);
  readonly institution = input<string | null>(null);
  readonly size = input(48);
  /** True when the badge sits directly on the page background instead of inside a card. */
  readonly onPage = input(false);

  protected readonly displayName = computed(() => this.name()?.trim() || 'Professor(a)');
  protected readonly initial = computed(() =>
    this.displayName().charAt(0).toLocaleUpperCase('pt-BR'),
  );
  protected readonly fontSize = computed(() => Math.max(16, this.size() * 0.34));
}
