import { ClassroomStatistics, StudentStatistics } from '../../core/teacher.models';
import { StackedValue } from '../../shared/charts/charts';
import { ChartTab } from '../../shared/charts/chart-tabs-card';
import { activityTypeLabel, formatIsoDate } from '../../shared/format';

/** Data of the charts shared by the dashboard and the student details page. */
export function distributionValues(stats: StudentStatistics): StackedValue[] {
  return [
    { label: 'Dominados', value: stats.distribution.mastered, color: 'var(--chart-2)' },
    { label: 'Em aprendizagem', value: stats.distribution.learning, color: 'var(--chart-1)' },
    { label: 'Não iniciados', value: stats.distribution.notStarted, color: 'var(--chart-3)' },
  ];
}

export function dailyChart(stats: StudentStatistics) {
  return {
    labels: stats.daily.map((item) => formatIsoDate(item.date)),
    details: stats.daily.map((item) => formatIsoDate(item.date, true)),
    series: [
      {
        label: 'Atividades',
        color: 'var(--chart-1)',
        values: stats.daily.map((item) => item.activities),
      },
      {
        label: 'Acertos (%)',
        color: 'var(--chart-2)',
        values: stats.daily.map((item) => item.correctRate),
      },
    ],
  };
}

export function typeLabels(stats: StudentStatistics): string[] {
  return stats.activityTypes.map((item) => activityTypeLabel(item.type));
}

export function typeRates(stats: StudentStatistics): number[] {
  return stats.activityTypes.map((item) => item.correctRate ?? 0);
}

export const bandLabels = (stats: ClassroomStatistics) =>
  stats.progressBands.map((item) => item.range);
export const bandValues = (stats: ClassroomStatistics) =>
  stats.progressBands.map((item) => item.students);
export const errorLabels = (stats: StudentStatistics) => stats.mostErrors.map((item) => item.name);
export const errorRates = (stats: StudentStatistics) =>
  stats.mostErrors.map((item) => item.errorRate);

export function hasTypeData(stats: StudentStatistics): boolean {
  return stats.activityTypes.some((item) => item.correctRate !== null);
}

/** Tab labels with the one-line summary shown under each chart. */
export function chartSummaries(
  stats: StudentStatistics | null,
): Record<'distribution' | 'daily' | 'types' | 'errors', string | undefined> {
  if (!stats)
    return { distribution: undefined, daily: undefined, types: undefined, errors: undefined };
  const { mastered, learning, notStarted } = stats.distribution;
  return {
    distribution: `${mastered} dominados · ${learning} em aprendizagem · ${notStarted} não iniciados`,
    daily: `${stats.daily.reduce((sum, item) => sum + item.activities, 0)} atividades no período`,
    types: `${stats.activityTypes.filter((item) => item.correctRate !== null).length} tipos com tentativas avaliáveis`,
    errors: `${stats.mostErrors.length} conceitos com tentativas suficientes para comparação`,
  };
}

export function bandsSummary(stats: ClassroomStatistics | null): string | undefined {
  return stats
    ? `${stats.progressBands.reduce((sum, item) => sum + item.students, 0)} alunos distribuídos por faixa de progresso`
    : undefined;
}

export type { ChartTab };

/** Everything the chart components need, built once per statistics response. */
export function buildChartData(stats: StudentStatistics | ClassroomStatistics) {
  return {
    distribution: distributionValues(stats),
    daily: dailyChart(stats),
    bandLabels: 'progressBands' in stats ? bandLabels(stats) : [],
    bandValues: 'progressBands' in stats ? bandValues(stats) : [],
    typeLabels: typeLabels(stats),
    typeRates: typeRates(stats),
    hasTypeData: hasTypeData(stats),
    errorLabels: errorLabels(stats),
    errorRates: errorRates(stats),
  };
}
