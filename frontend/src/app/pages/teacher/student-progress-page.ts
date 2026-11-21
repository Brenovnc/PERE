import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatisticsFilters, StudentProgress, StudentStatistics } from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { BarChart, LineChart, StackedBarChart } from '../../shared/charts/charts';
import { ChartTab, ChartTabsCard } from '../../shared/charts/chart-tabs-card';
import {
  defaultStatisticsFilters,
  StatisticsFiltersComponent,
  statisticsFilterSummary,
  statisticsFiltersReady,
} from '../../shared/charts/statistics-filters';
import { EmptyState } from '../../shared/empty-state';
import { PageHeader } from '../../shared/page-header';
import * as charts from './teacher-charts';

@Component({
  selector: 'app-student-progress-page',
  imports: [
    PageHeader,
    EmptyState,
    RouterLink,
    ChartTabsCard,
    StatisticsFiltersComponent,
    LineChart,
    BarChart,
    StackedBarChart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './student-progress-page.html',
  styleUrl: './student-progress-page.css',
})
export class StudentProgressPage implements OnInit {
  private readonly teacher = inject(TeacherService);
  private request = 0;

  /** Route parameters. */
  readonly classroomId = input.required<string>();
  readonly studentId = input.required<string>();

  protected readonly data = signal<StudentProgress | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly stats = signal<StudentStatistics | null>(null);
  protected readonly statsLoading = signal(false);
  protected readonly statsError = signal('');
  protected readonly filters = signal<StatisticsFilters>(defaultStatisticsFilters);
  protected readonly tab = signal('distribution');
  private readonly retry = signal(0);

  protected readonly modules = computed(() =>
    (this.data()?.modules ?? []).map((item) => ({ id: item.moduleId, label: item.title })),
  );
  protected readonly filtersReady = computed(() => statisticsFiltersReady(this.filters()));
  protected readonly filterSummary = computed(() =>
    statisticsFilterSummary(this.filters(), this.modules()),
  );
  protected readonly chartData = computed(() => {
    const stats = this.stats();
    return stats ? charts.buildChartData(stats) : null;
  });
  protected readonly tabs = computed<ChartTab[]>(() => {
    const summaries = charts.chartSummaries(this.stats());
    return [
      { id: 'distribution', label: 'Distribuição dos conceitos', summary: summaries.distribution },
      { id: 'daily', label: 'Atividades e acertos', summary: summaries.daily },
      { id: 'types', label: 'Acerto por atividade', summary: summaries.types },
      { id: 'errors', label: 'Conceitos com mais erros', summary: summaries.errors },
    ];
  });

  constructor() {
    effect(() => {
      const filters = this.filters();
      this.retry();
      if (statisticsFiltersReady(filters)) untracked(() => void this.loadStats(filters));
    });
  }

  ngOnInit(): void {
    void this.loadProgress();
  }

  private async loadProgress(): Promise<void> {
    try {
      this.data.set(await this.teacher.studentProgress(this.classroomId(), this.studentId()));
    } catch {
      this.error.set('Não foi possível carregar o progresso deste aluno.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadStats(filters: StatisticsFilters): Promise<void> {
    const request = ++this.request;
    this.statsLoading.set(true);
    this.statsError.set('');
    try {
      const stats = await this.teacher.studentStatistics(
        this.classroomId(),
        this.studentId(),
        filters,
      );
      if (request === this.request) this.stats.set(stats);
    } catch {
      if (request === this.request)
        this.statsError.set('Não foi possível atualizar as estatísticas do aluno.');
    } finally {
      if (request === this.request) this.statsLoading.set(false);
    }
  }

  protected tryAgain(): void {
    this.retry.update((value) => value + 1);
  }
}
