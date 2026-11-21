import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface ChartSeries {
  label: string;
  values: (number | null)[];
  color: string;
}

export interface StackedValue {
  label: string;
  value: number;
  color: string;
}

/** Shared styles of the three charts. */
const chartStyles = `
  .chart {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: clamp(22rem, 55vh, 40rem);
    padding: clamp(1.25rem, 3vw, 2rem);
    border: 1px solid var(--border);
    border-radius: 14px;
    color: var(--text);
    background: var(--surface);
  }
  h3 { margin: 0 0 0.8rem; font-size: 1.25rem; }
  .empty { margin: 0.5rem 0; color: var(--text); }
  .svg { display: block; width: 100%; height: clamp(15rem, 40vh, 30rem); overflow: visible; }
  .stacked { display: block; width: 100%; height: clamp(14rem, 35vh, 24rem); }
  svg line { stroke: var(--text-muted); stroke-width: 1; }
  svg text { fill: var(--text); font-size: 14px; }
  .svg path { fill: none; stroke-width: 3; }
  .bar { fill: var(--chart-1); }
  .legend {
    display: flex; flex-wrap: wrap; gap: 0.75rem 1.3rem;
    margin: 0.5rem 0 0; padding: 0; list-style: none; font-size: 1rem;
  }
  .swatch {
    display: inline-block; width: 0.7rem; height: 0.7rem; margin-right: 0.35rem;
    border-radius: 2px;
  }
`;

@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chart" [attr.aria-label]="title()">
      <h3>{{ title() }}</h3>
      @if (!hasData()) {
        <p class="empty">Ainda não há atividades neste período</p>
      } @else {
        <svg class="svg" viewBox="0 0 600 250" role="img" [attr.aria-label]="title()">
          <line x1="46" y1="38" x2="46" y2="204" />
          <line x1="46" y1="204" x2="554" y2="204" />
          <text x="48" y="22">Atividades</text>
          @for (line of lines(); track line.label) {
            <g>
              <path [attr.d]="line.path" [attr.stroke]="line.color" />
              @for (point of line.points; track $index) {
                @if (point) {
                  <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4" [attr.fill]="line.color">
                    <title>{{ details()[$index] }}: {{ point.value }}</title>
                  </circle>
                }
              }
            </g>
          }
          @for (tick of ticks(); track tick.index) {
            <text [attr.x]="tick.x" y="230">{{ tick.label }}</text>
          }
        </svg>
        <ul class="legend">
          @for (item of series(); track item.label) {
            <li>
              <span class="swatch" aria-hidden="true" [style.background]="item.color"></span
              >{{ item.label }}
            </li>
          }
        </ul>
        <table class="sr-only">
          <caption>
            {{
              title()
            }}
          </caption>
          <thead>
            <tr>
              <th>Data</th>
              @for (item of series(); track item.label) {
                <th>{{ item.label }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (label of labels(); track $index; let index = $index) {
              <tr>
                <th>{{ details()[index] }}</th>
                @for (item of series(); track item.label) {
                  <td>{{ item.values[index] ?? 'Sem dados' }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: chartStyles,
})
export class LineChart {
  readonly title = input.required<string>();
  readonly labels = input.required<string[]>();
  /** Longer labels for tooltips and the accessible table (dates with the year). */
  readonly details = input.required<string[]>();
  readonly series = input.required<ChartSeries[]>();

  protected readonly hasData = computed(() =>
    this.series().some((item) => item.values.some((value) => value !== null)),
  );

  private readonly xAt = (index: number) =>
    48 + index * (504 / Math.max(1, this.labels().length - 1));

  protected readonly lines = computed(() => {
    const values = this.series().flatMap((item) =>
      item.values.filter((value): value is number => value !== null),
    );
    const max = Math.max(1, ...values);
    const min = Math.min(0, ...values);
    return this.series().map((item) => {
      const points = item.values.map((value, index) =>
        value === null
          ? null
          : { x: this.xAt(index), y: 202 - ((value - min) / Math.max(1, max - min)) * 164, value },
      );
      // A null value breaks the line instead of connecting across the gap.
      let drawing = false;
      const path = points
        .map((point) => {
          if (!point) {
            drawing = false;
            return '';
          }
          const command = drawing ? 'L' : 'M';
          drawing = true;
          return `${command} ${point.x} ${point.y}`;
        })
        .filter(Boolean)
        .join(' ');
      return { label: item.label, color: item.color, points, path };
    });
  });

  protected readonly ticks = computed(() => {
    const labels = this.labels();
    const step = Math.ceil(labels.length / 5);
    return labels
      .map((label, index) => ({ label, index, x: this.xAt(index) }))
      .filter(({ index }) => index === 0 || index === labels.length - 1 || index % step === 0);
  });
}

@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chart" [attr.aria-label]="title()">
      <h3>{{ title() }}</h3>
      @if (!showData()) {
        <p class="empty">{{ emptyText() }}</p>
      } @else {
        <svg class="svg" viewBox="0 0 600 250" role="img" [attr.aria-label]="title()">
          <line x1="46" y1="38" x2="46" y2="204" />
          <line x1="46" y1="204" x2="554" y2="204" />
          @for (bar of bars(); track $index) {
            <g>
              <rect
                class="bar"
                [attr.x]="bar.x"
                [attr.y]="204 - bar.height"
                [attr.width]="bar.width"
                [attr.height]="bar.height"
                rx="3"
              />
              <text [attr.x]="bar.x + bar.width / 2" [attr.y]="bar.valueY" text-anchor="middle">
                {{ bar.value }}{{ suffix() }}
              </text>
              <text [attr.x]="bar.x + bar.width / 2" y="226" text-anchor="middle">
                {{ bar.label }}
              </text>
            </g>
          }
        </svg>
        <table class="sr-only">
          <caption>
            {{
              title()
            }}
          </caption>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            @for (bar of bars(); track $index) {
              <tr>
                <th>{{ bar.label }}</th>
                <td>{{ bar.value }}{{ suffix() }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: chartStyles,
})
export class BarChart {
  readonly title = input.required<string>();
  readonly labels = input.required<string[]>();
  readonly values = input.required<number[]>();
  readonly suffix = input('');
  /** Overrides the default "some value above zero" test. */
  readonly hasData = input<boolean | undefined>(undefined);
  readonly emptyText = input('Ainda não há atividades neste período');

  protected readonly showData = computed(
    () => this.hasData() ?? this.values().some((value) => value > 0),
  );

  protected readonly bars = computed(() => {
    const values = this.values();
    const max = Math.max(1, ...values);
    const step = 496 / Math.max(1, values.length);
    const width = Math.min(64, step * 0.55);
    return values.map((value, index) => {
      const height = (value / max) * 156;
      const x = 52 + index * step + (step - width) / 2;
      return {
        value,
        label: this.labels()[index],
        x,
        width,
        height,
        valueY: Math.max(33, 199 - height),
      };
    });
  });
}

@Component({
  selector: 'app-stacked-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="chart" [attr.aria-label]="title()">
      <h3>{{ title() }}</h3>
      @if (total() === 0) {
        <p class="empty">Ainda não há dados neste período</p>
      } @else {
        <svg class="stacked" viewBox="0 0 600 135" role="img" [attr.aria-label]="title()">
          <text x="20" y="22">{{ title() }}</text>
          @for (segment of segments(); track segment.label) {
            <g>
              <rect
                [attr.x]="segment.x"
                y="42"
                [attr.width]="segment.width"
                height="42"
                [attr.fill]="segment.color"
              />
              @if (segment.width > 48) {
                <text [attr.x]="segment.x + segment.width / 2" y="68" text-anchor="middle">
                  {{ segment.value }}
                </text>
              }
            </g>
          }
        </svg>
        <ul class="legend">
          @for (item of values(); track item.label) {
            <li>
              <span class="swatch" aria-hidden="true" [style.background]="item.color"></span
              >{{ item.label }} ({{ item.value }})
            </li>
          }
        </ul>
        <table class="sr-only">
          <caption>
            {{
              title()
            }}
          </caption>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Conceitos</th>
            </tr>
          </thead>
          <tbody>
            @for (item of values(); track item.label) {
              <tr>
                <th>{{ item.label }}</th>
                <td>{{ item.value }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </section>
  `,
  styles: chartStyles,
})
export class StackedBarChart {
  readonly title = input.required<string>();
  readonly values = input.required<StackedValue[]>();

  protected readonly total = computed(() =>
    this.values().reduce((sum, item) => sum + item.value, 0),
  );

  protected readonly segments = computed(() => {
    let offset = 0;
    return this.values().map((item) => {
      const width = (560 * item.value) / this.total();
      const segment = { ...item, x: 20 + offset, width };
      offset += width;
      return segment;
    });
  });
}
