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
import { Router, RouterLink } from '@angular/router';
import {
  ClassroomProgress,
  ClassroomStatistics,
  ClassroomSummary,
  StatisticsFilters,
} from '../../core/teacher.models';
import { TeacherService } from '../../core/teacher.service';
import { BarChart, LineChart, StackedBarChart } from '../../shared/charts/charts';
import { ChartTab, ChartTabsCard } from '../../shared/charts/chart-tabs-card';
import {
  defaultStatisticsFilters,
  FilterOption,
  StatisticsFiltersComponent,
  statisticsFilterSummary,
  statisticsFiltersReady,
} from '../../shared/charts/statistics-filters';
import { EmptyState } from '../../shared/empty-state';
import { formatLastAccess } from '../../shared/format';
import { PageHeader } from '../../shared/page-header';
import * as charts from './teacher-charts';

const lastClassroomKey = 'pere.lastClassroom';

function readLastClassroom(): string {
  try {
    return localStorage.getItem(lastClassroomKey) ?? '';
  } catch {
    return '';
  }
}

@Component({
  selector: 'app-teacher-dashboard-page',
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
  templateUrl: './teacher-dashboard-page.html',
  styleUrl: './teacher-dashboard-page.css',
})
export class TeacherDashboardPage implements OnInit {
  private readonly teacher = inject(TeacherService);
  private readonly router = inject(Router);
  private request = 0;

  /** Query parameter: the classroom to open. */
  readonly classroom = input<string>();

  protected readonly formatLastAccess = formatLastAccess;
  protected readonly classrooms = signal<ClassroomSummary[]>([]);
  protected readonly classroomId = signal('');
  protected readonly modules = signal<FilterOption[]>([]);
  protected readonly progress = signal<ClassroomProgress | null>(null);
  protected readonly stats = signal<ClassroomStatistics | null>(null);
  protected readonly filters = signal<StatisticsFilters>(defaultStatisticsFilters);
  protected readonly tab = signal('distribution');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private readonly retry = signal(0);

  protected readonly selected = computed(() =>
    this.classrooms().find((item) => item.id === this.classroomId()),
  );
  protected readonly chartData = computed(() => {
    const stats = this.stats();
    return stats ? charts.buildChartData(stats) : null;
  });
  protected readonly filtersReady = computed(() => statisticsFiltersReady(this.filters()));
  protected readonly filterSummary = computed(() =>
    statisticsFilterSummary(this.filters(), this.modules()),
  );
  /** Period and activity type only affect the daily, type and error charts. */
  protected readonly timeFiltered = computed(() =>
    ['daily', 'types', 'errors'].includes(this.tab()),
  );
  protected readonly tabs = computed<ChartTab[]>(() => {
    const summaries = charts.chartSummaries(this.stats());
    return [
      { id: 'distribution', label: 'Distribuição', summary: summaries.distribution },
      { id: 'daily', label: 'Atividades e acertos', summary: summaries.daily },
      { id: 'bands', label: 'Faixas de progresso', summary: charts.bandsSummary(this.stats()) },
      { id: 'types', label: 'Acerto por atividade', summary: summaries.types },
      { id: 'errors', label: 'Mais erros', summary: summaries.errors },
    ];
  });

  constructor() {
    effect(() => {
      const classroomId = this.classroomId();
      const filters = this.filters();
      this.retry();
      if (classroomId && statisticsFiltersReady(filters))
        untracked(() => void this.loadClassroom(classroomId, filters));
    });
  }

  ngOnInit(): void {
    void this.loadClassrooms();
  }

  private async loadClassrooms(): Promise<void> {
    try {
      const active = (await this.teacher.listClassrooms()).filter((c) => c.status === 'Active');
      this.classrooms.set(active);
      const has = (id: string | undefined) => !!id && active.some((c) => c.id === id);
      const stored = readLastClassroom();
      const chosen = has(this.classroom())
        ? this.classroom()!
        : has(stored)
          ? stored
          : (active[0]?.id ?? '');
      if (chosen) this.selectClassroom(chosen, false);
      else this.loading.set(false);
    } catch {
      this.error.set('Não foi possível carregar as turmas.');
      this.loading.set(false);
    }
  }

  private async loadClassroom(classroomId: string, filters: StatisticsFilters): Promise<void> {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const [progress, stats] = await Promise.all([
        this.teacher.classroomProgress(classroomId),
        this.teacher.classroomStatistics(classroomId, filters),
      ]);
      if (request !== this.request) return;
      this.progress.set(progress);
      this.stats.set(stats);
    } catch {
      if (request === this.request) this.error.set('Não foi possível carregar os dados da turma.');
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }

  private async loadModules(classroomId: string): Promise<void> {
    try {
      const details = await this.teacher.getClassroom(classroomId);
      this.modules.set(
        details.modules
          .filter((m) => m.status === 'Published')
          .map((m) => ({ id: m.id, label: m.title })),
      );
    } catch {
      this.modules.set([]);
    }
  }

  protected selectClassroom(id: string, updateUrl = true): void {
    this.classroomId.set(id);
    this.filters.set(defaultStatisticsFilters);
    this.stats.set(null);
    this.progress.set(null);
    void this.loadModules(id);
    try {
      localStorage.setItem(lastClassroomKey, id);
    } catch {
      // Storage may be blocked; the choice just is not remembered.
    }
    if (updateUrl)
      void this.router.navigate([], { queryParams: { classroom: id }, replaceUrl: true });
  }

  protected tryAgain(): void {
    this.retry.update((value) => value + 1);
  }
}
