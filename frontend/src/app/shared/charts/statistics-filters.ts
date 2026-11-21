import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { StatisticsFilters as Filters } from '../../core/teacher.models';
import { activityTypeLabel, formatIsoDate } from '../format';

export interface FilterOption {
  id: string;
  label: string;
}

export const defaultStatisticsFilters: Filters = { days: 30 };

const filterableTypes = ['TRUE_FALSE', 'FILL_BLANK', 'GUESS_CONCEPT', 'ORDERING'];

function today(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A custom period needs both dates, in order, up to today and shorter than 180 days. */
export function statisticsFiltersReady(value: Filters): boolean {
  if (!value.custom) return true;
  if (!value.from || !value.to || value.from > value.to || value.to > today()) return false;
  const span =
    (new Date(`${value.to}T00:00:00Z`).getTime() - new Date(`${value.from}T00:00:00Z`).getTime()) /
    86_400_000;
  return span < 180;
}

export function statisticsFilterSummary(value: Filters, modules: FilterOption[]): string {
  const parts = [
    value.custom
      ? value.from && value.to
        ? `${formatIsoDate(value.from, true)} a ${formatIsoDate(value.to, true)}`
        : 'Período personalizado incompleto'
      : `Últimos ${value.days ?? 30} dias`,
  ];
  if (value.moduleId)
    parts.push(modules.find((item) => item.id === value.moduleId)?.label ?? 'Módulo selecionado');
  if (value.activityType) parts.push(activityTypeLabel(value.activityType));
  if (value.minAttempts) parts.push(`Mínimo de ${value.minAttempts} tentativas`);
  return parts.join(' · ');
}

/** Period, module, activity type and minimum attempts. Fields that do not apply to the chart are disabled. */
@Component({
  selector: 'app-statistics-filters',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './statistics-filters.html',
  styleUrl: './statistics-filters.css',
})
export class StatisticsFiltersComponent {
  readonly value = model.required<Filters>();
  readonly modules = input<FilterOption[]>([]);
  readonly showMinAttempts = input(false);
  /** The dashboard shows its own "Limpar filtros" button in the panel header. */
  readonly showClear = input(true);
  readonly disablePeriod = input(false);
  readonly disableActivityType = input(false);
  readonly disableMinAttempts = input(false);

  protected readonly types = filterableTypes;
  protected readonly activityTypeLabel = activityTypeLabel;
  protected readonly maxToday = today();
  protected readonly fromMin = computed(() => shiftDate(this.value().to || this.maxToday, -179));
  protected readonly toMax = computed(() => {
    const from = this.value().from;
    return from ? [this.maxToday, shiftDate(from, 179)].sort()[0] : this.maxToday;
  });

  protected update(partial: Partial<Filters>): void {
    this.value.update((current) => ({ ...current, ...partial }));
  }

  protected setMinAttempts(value: string): void {
    this.update({ minAttempts: Number(value) });
  }

  protected changePeriod(selected: string): void {
    if (selected === 'custom') this.update({ custom: true, days: undefined, from: '', to: '' });
    else this.update({ custom: false, days: Number(selected), from: undefined, to: undefined });
  }

  clear(): void {
    this.value.set({
      ...defaultStatisticsFilters,
      ...(this.showMinAttempts() ? { minAttempts: 3 } : {}),
    });
  }
}
