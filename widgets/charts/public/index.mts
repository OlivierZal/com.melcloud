import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import { ClassicDeviceType } from '@olivierzal/melcloud-api/constants'
import {
  type ChartConfiguration,
  type ChartOptions,
  type Plugin as ChartPlugin,
  ArcElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Temporal } from 'temporal-polyfill'

import type {
  DaysQuery,
  ChartsWidgetSettings as HomeySettings,
} from '../../../types/widgets.mts'
import {
  createOption,
  getDiv,
  getSelect,
  translateAriaLabels,
} from '../../../public/dom.mts'
import {
  type Homey,
  fireAndForget,
  homeyApiGet,
  setDocumentLanguage,
  surfaceError,
} from '../../../public/homey-api.mts'
import { getZoneId, getZonePath } from '../../../public/zones.mts'

// Register only what the two chart types use so esbuild tree-shakes the rest.
Chart.register(
  ArcElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  Title,
  Tooltip,
)

// Historical widget font stack, kept over the Homey font variables so the
// rendered charts keep their established look.
const FONT_FAMILY = 'Helvetica, Arial, sans-serif'
Chart.defaults.font.family = FONT_FAMILY

const FONT_SIZE_VERY_SMALL = 12
const GRID_LINE_DASH_PX = 3
const HALF_TURN_DEGREES = 180
const HOURLY_CHART_REFRESH_MS = 60_000
const LINE_WIDTH = 5
const PERCENT_FACTOR = 100
// Slices narrower than this angle get no percentage label.
const PIE_LABEL_MIN_ANGLE_DEGREES = 10
const PIE_LABEL_RADIUS_RATIO = 0.8

interface ChartSelection {
  readonly chart: HomeySettings['default_chart']
  readonly days: number
  readonly zoneValue: string
}

type FontWeight = number | 'bold' | 'bolder' | 'lighter' | 'normal'

type WidgetChartConfig = ChartConfiguration<
  WidgetChartType,
  (number | null)[],
  string
> & { options: WidgetChartOptions }

type WidgetChartOptions = ChartOptions<WidgetChartType>

type WidgetChartType = 'line' | 'pie'

// Picker line-up, in the order the widget settings dropdown lists them.
const CHARTS: readonly HomeySettings['default_chart'][] = [
  'operation_modes',
  'temperatures',
  'hourly_temperatures',
  'signal',
]

// Curated day counts offered by the picker, string-typed because they feed
// `<option>` values; the configured default is merged in so an off-ladder
// value stays selectable.
const DAY_CHOICES: readonly `${number}`[] = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '14',
  '21',
  '30',
  '60',
  '90',
  '180',
  '365',
]

const chartsWithDays = new Set<HomeySettings['default_chart']>([
  'operation_modes',
  'temperatures',
])
const hourlyCharts = new Set<HomeySettings['default_chart']>([
  'hourly_temperatures',
  'signal',
])

// D3/Tableau-inspired color palette for chart series
const colors = [
  '#1F77B4',
  '#D62728',
  '#2CA02C',
  '#FF7F0E',
  '#9467BD',
  '#FFDB58',
  '#17BECF',
  '#E377C2',
  '#7F7F7F',
  '#393B79',
  '#E7BA52',
]
const hidden: ReadonlySet<string> = new Set([
  'FlowBoiler',
  'FlowZone1',
  'FlowZone2',
  'MixingTankWater',
  'ReturnBoiler',
  'ReturnZone1',
  'ReturnZone2',
])
const styleCache: Record<string, string> = {}

// ── Style helpers ──

const getStyle = (property: string): string => {
  styleCache[property] ??= getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim()
  return styleCache[property]
}

const getFontWeight = (property: string): FontWeight => {
  const value = getStyle(property)
  switch (value) {
    case 'bold':
    case 'bolder':
    case 'lighter':
    case 'normal': {
      return value
    }
    default: {
      return Number(value)
    }
  }
}

const normalizeSeriesName = (name: string): string =>
  name.replace('ClassicTemperature', '')

const toRadians = (degrees: number): number =>
  (degrees * Math.PI) / HALF_TURN_DEGREES

// ── Select helpers ──

// Guarded assignment: writing a value with no matching option would reset
// the select to an empty selection.
const applySelectValue = (select: HTMLSelectElement, value: string): void => {
  if (select.querySelector(`option[value="${CSS.escape(value)}"]`) !== null) {
    select.value = value
  }
}

// The integer filter shields the picker from a value the wire may carry
// despite the manifest bounds: a pre-rename instance (no stored value) or
// a default saved before the bounds existed.
const getDayValues = (defaultDays: number): number[] =>
  [...new Set([...DAY_CHOICES.map(Number), defaultDays])]
    .filter((days) => Number.isSafeInteger(days) && days > 0)
    .toSorted((first, second) => first - second)

const isChart = (value: string): value is HomeySettings['default_chart'] => {
  // Widened, not asserted: `includes` on the union-typed array rejects a
  // plain string argument.
  const charts: readonly string[] = CHARTS
  return charts.includes(value)
}

const isSameSelection = (
  first: ChartSelection,
  second: ChartSelection,
): boolean =>
  first.chart === second.chart &&
  first.days === second.days &&
  first.zoneValue === second.zoneValue

// ── Pie data labels plugin ──
// Chart.js has no built-in data labels; this plugin draws each slice's
// percentage at 80% of the radius, skipping slices too narrow to fit one.

const applyPieLabelStyle = (ctx: CanvasRenderingContext2D): void => {
  ctx.fillStyle = getStyle('--homey-text-color')
  ctx.font = `${getStyle('--homey-font-weight-bold')} ${getStyle('--homey-font-size-small')} ${FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
}

const drawPieLabel = (
  ctx: CanvasRenderingContext2D,
  arc: ArcElement,
  text: string,
): void => {
  const {
    endAngle,
    outerRadius,
    startAngle,
    x: centerX,
    y: centerY,
  } = arc.getProps(['endAngle', 'outerRadius', 'startAngle', 'x', 'y'], true)
  if (centerX === null || centerY === null) {
    return
  }
  const angle = (startAngle + endAngle) / 2
  const radius = outerRadius * PIE_LABEL_RADIUS_RATIO
  ctx.fillText(
    text,
    centerX + Math.cos(angle) * radius,
    centerY + Math.sin(angle) * radius,
  )
}

const formatPieLabel = (value: number, total: number): string =>
  `${((value / total) * PERCENT_FACTOR).toFixed(1)}%`

const getVisiblePieTotal = (chart: Chart<WidgetChartType>): number => {
  let total = 0
  const values = chart.data.datasets.flatMap(({ data }) => data)
  for (const [index, value] of values.entries()) {
    if (typeof value === 'number' && chart.getDataVisibility(index)) {
      total += value
    }
  }
  return total
}

const isPieLabelVisible = (arc: ArcElement): boolean =>
  arc.getProps(['circumference'], true).circumference >=
  toRadians(PIE_LABEL_MIN_ANGLE_DEGREES)

const pieDataLabelsPlugin: ChartPlugin<WidgetChartType> = {
  id: 'pieDataLabels',
  afterDatasetsDraw: (chart): void => {
    const { ctx } = chart
    const values = chart.data.datasets.flatMap(({ data }) => data)
    const total = getVisiblePieTotal(chart)
    ctx.save()
    applyPieLabelStyle(ctx)
    for (const [index, element] of chart.getDatasetMeta(0).data.entries()) {
      const value = values[index]
      if (
        typeof value === 'number' &&
        element instanceof ArcElement &&
        isPieLabelVisible(element)
      ) {
        drawPieLabel(ctx, element, formatPieLabel(value, total))
      }
    }
    ctx.restore()
  },
}

// ── Shared chart config ──

const getFontConfig = (): { size: number; weight: FontWeight } => ({
  size: FONT_SIZE_VERY_SMALL,
  weight: getFontWeight('--homey-font-weight-regular'),
})

// Line charts show the legend at the bottom; pie charts show it on the
// right, top-aligned.
const getLegendConfig = (
  position: 'bottom' | 'right',
): {
  align: 'center' | 'start'
  labels: {
    boxHeight: number
    boxWidth: number
    color: string
    font: { size: number; weight: FontWeight }
  }
  position: 'bottom' | 'right'
} => ({
  align: position === 'right' ? 'start' : 'center',
  labels: {
    boxHeight: FONT_SIZE_VERY_SMALL,
    boxWidth: FONT_SIZE_VERY_SMALL,
    color: getStyle('--homey-text-color-light'),
    font: getFontConfig(),
  },
  position,
})

// ── Chart options ──

const getLineDatasets = (
  series: ReportChartLineOptions['series'],
): WidgetChartConfig['data']['datasets'] =>
  series.map(({ data, name }, index) => {
    const seriesName = normalizeSeriesName(name)
    const color = colors[index % colors.length]
    return {
      backgroundColor: color,
      borderColor: color,
      data: [...data],
      hidden: hidden.has(seriesName),
      label: seriesName,
      xAxisID: 'xAxis',
      yAxisID: 'yAxis',
    }
  })

const getLineScalesConfig = (
  unit: string,
): NonNullable<WidgetChartOptions['scales']> => {
  const colorLight = getStyle('--homey-text-color-light')
  const ticksStyle = { color: colorLight, font: getFontConfig() }
  return {
    // Chart.js infers the axis from the leading `x`/`y` of the scale id.
    xAxis: {
      border: { color: colorLight, display: true },
      grid: {
        drawOnChartArea: false,
        drawTicks: true,
        tickColor: colorLight,
        tickLength: 6,
      },
      ticks: { ...ticksStyle, maxRotation: 0, maxTicksLimit: 4 },
    },
    yAxis: {
      // In Chart.js v4, `border.dash` styles the grid lines
      // (`_computeGridLineItems` reads it per line), while `drawBorder`
      // always strokes the axis border solid.
      border: {
        color: colorLight,
        dash: [GRID_LINE_DASH_PX, GRID_LINE_DASH_PX],
        display: true,
      },
      grid: {
        color: colorLight,
        drawTicks: true,
        tickColor: colorLight,
        tickLength: 6,
      },
      ticks: {
        ...ticksStyle,
        // Keeps the historical ~5 y-axis intervals.
        maxTicksLimit: 6,
        callback: (value) => Number(value).toFixed(0),
      },
      ...(unit === 'dBm' && { max: 0, min: -100 }),
    },
  }
}

const getChartLineConfig = ({
  labels,
  series,
  unit,
}: ReportChartLineOptions): WidgetChartConfig => ({
  data: {
    datasets: getLineDatasets(series),
    labels: [...labels],
  },
  options: {
    elements: {
      // Monotone interpolation smooths the line without overshooting data
      // points (and ignores `tension`).
      line: { borderWidth: LINE_WIDTH, cubicInterpolationMode: 'monotone' },
      point: { radius: 0 },
    },
    interaction: { intersect: false, mode: 'index' },
    maintainAspectRatio: false,
    plugins: {
      // Single-series charts do not need a legend.
      legend: { ...getLegendConfig('bottom'), display: series.length > 1 },
      title: {
        align: 'start',
        color: getStyle('--homey-text-color-light'),
        display: true,
        font: getFontConfig(),
        text: unit,
      },
    },
    scales: getLineScalesConfig(unit),
    // Break the line at missing data points instead of bridging them.
    spanGaps: false,
  },
  type: 'line',
})

const getChartPieConfig = ({
  labels,
  series,
}: ReportChartPieOptions): WidgetChartConfig => ({
  data: {
    datasets: [
      { backgroundColor: [...colors], borderWidth: 0, data: [...series] },
    ],
    // Clean up MELCloud operation mode labels for display
    // (e.g., 'CoolingMode' -> 'Cooling')
    labels: labels.map((label) => {
      const cleaned = label
        .replace('Actual', '')
        .replace('FansStopped', 'Stop')
        .replace('Mode', '')
        .replace('Operation', '')
        .replace('PowerOff', 'Off')
        .replace('Power', 'Off')
        .replace('Prevention', '')
      // Plain suffix strip — a `/(.+)Ventilation$/` regex would backtrack.
      // The length check preserves a label that is exactly 'Ventilation',
      // matching the old regex which required at least one leading char.
      return (
          cleaned.length > 'Ventilation'.length &&
            cleaned.endsWith('Ventilation')
        ) ?
          cleaned.slice(0, -'Ventilation'.length)
        : cleaned
    }),
  },
  options: {
    maintainAspectRatio: false,
    plugins: {
      // Always shown: the legend is the only place the mode names appear
      // (slices only carry percentages), even for a single-mode report.
      legend: getLegendConfig('right'),
    },
  },
  plugins: [pieDataLabelsPlugin],
  type: 'pie',
})

const getChartConfig = (
  data: ReportChartLineOptions | ReportChartPieOptions,
): WidgetChartConfig =>
  'unit' in data ? getChartLineConfig(data) : getChartPieConfig(data)

// ── Chart data fetching ──

const fetchChartData = async (
  homey: Homey,
  { chart, days, zoneValue }: ChartSelection,
): Promise<ReportChartLineOptions | ReportChartPieOptions> => {
  const daysQuery =
    chartsWithDays.has(chart) ?
      `?${new URLSearchParams({ days: String(days) } satisfies DaysQuery)}`
    : ''
  return homeyApiGet<ReportChartLineOptions | ReportChartPieOptions>(
    homey,
    `/classic/${zoneValue}/logs/${chart.replaceAll('_', '-')}${daysQuery}`,
  )
}

// Charts of hourly data poll every minute so the latest point shows up
// promptly; daily aggregates only change after the full hour plus
// MELCloud's 5-minute aggregation delay, so wait for that instant.
const getTimeout = (chart: HomeySettings['default_chart']): number => {
  if (hourlyCharts.has(chart)) {
    return HOURLY_CHART_REFRESH_MS
  }
  const now = Temporal.Now.zonedDateTimeISO()
  const next = now.add({ hours: 1 }).with({
    microsecond: 0,
    millisecond: 0,
    minute: 5,
    nanosecond: 0,
    second: 0,
  })
  return now.until(next).total('milliseconds')
}

// Line-dataset visibility flows through `dataset.hidden`: replacing the data
// rebuilds the metas (they key on dataset object identity), and Chart.js then
// falls back to `dataset.hidden`, so writing the captured state there is what
// carries legend toggles across refreshes.
const applyHiddenByLabel = (
  config: WidgetChartConfig,
  hiddenByLabel: ReadonlyMap<string, boolean>,
): void => {
  if (config.type === 'pie') {
    return
  }
  for (const dataset of config.data.datasets) {
    const isHidden =
      dataset.label === undefined ? undefined : hiddenByLabel.get(dataset.label)
    if (isHidden !== undefined) {
      dataset.hidden = isHidden
    }
  }
}

// Pie-slice visibility cannot be seeded through the config (Chart.js only
// exposes the index-keyed `toggleDataVisibility`), so a recreated pie
// re-applies the captured state by label after construction.
const applyPieHiddenByLabel = (
  chart: Chart<WidgetChartType, (number | null)[], string>,
  config: WidgetChartConfig,
  hiddenByLabel: ReadonlyMap<string, boolean>,
): void => {
  const hiddenIndices = (config.data.labels ?? []).flatMap((label, index) =>
    hiddenByLabel.get(label) === true ? [index] : [],
  )
  if (hiddenIndices.length > 0) {
    for (const index of hiddenIndices) {
      chart.toggleDataVisibility(index)
    }
    chart.update()
  }
}

// ── ChartWidget class ──
class ChartWidget {
  #chart: Chart<WidgetChartType, (number | null)[], string> | null = null

  readonly #chartSelect: HTMLSelectElement

  #config: WidgetChartConfig | null = null

  readonly #daySelect: HTMLSelectElement

  readonly #defaultChart: HomeySettings['default_chart']

  readonly #defaultDays: number

  readonly #defaultZone: HomeySettings['default_zone']

  readonly #height: number

  readonly #homey: Homey<HomeySettings>

  #timeout: NodeJS.Timeout | null = null

  readonly #zoneSelect: HTMLSelectElement

  public constructor(homey: Homey<HomeySettings>) {
    this.#homey = homey
    const {
      default_chart: defaultChart,
      default_days: defaultDays,
      default_zone: defaultZone,
      height,
    } = homey.getSettings()
    this.#defaultChart = defaultChart
    this.#defaultDays = defaultDays
    this.#defaultZone = defaultZone
    this.#height = Number(height)
    this.#chartSelect = getSelect('charts')
    this.#daySelect = getSelect('days')
    this.#zoneSelect = getSelect('zones')
  }

  public async init(): Promise<void> {
    translateAriaLabels((key) => this.#homey.__(key))
    // Sequenced, not parallel: the day picker labels are formatted with
    // the app language, so it must land before the pickers are populated.
    await setDocumentLanguage(this.#homey)
    await this.#initControls()
    this.#homey.ready({ height: document.body.scrollHeight })
  }

  #addEventListeners(
    devicesForChart: () => readonly Classic.DeviceZone[],
  ): void {
    this.#chartSelect.addEventListener('change', () => {
      this.#repopulateZoneOptions(devicesForChart())
      this.#syncDayVisibility()
      this.#redraw()
    })
    this.#daySelect.addEventListener('change', () => {
      this.#redraw()
    })
    this.#zoneSelect.addEventListener('change', () => {
      this.#redraw()
    })
  }

  #applyDefaultZone(): void {
    if (this.#defaultZone === null) {
      return
    }
    const { id, model } = this.#defaultZone
    applySelectValue(this.#zoneSelect, getZoneId(id, model))
  }

  // Chart.js keeps legend-toggle state where it does not survive this
  // widget's refreshes (line metas key on dataset object identity) or a pie
  // recreation (`_hiddenIndices` is index-keyed), so the live visibility is
  // captured by label and re-applied to each freshly fetched config.
  #captureHiddenByLabel(): ReadonlyMap<string, boolean> {
    const chart = this.#chart
    if (chart === null || this.#config === null) {
      return new Map()
    }
    if (this.#config.type === 'pie') {
      return new Map(
        (chart.data.labels ?? []).map((label, index): [string, boolean] => [
          label,
          !chart.getDataVisibility(index),
        ]),
      )
    }
    return new Map(
      chart.data.datasets.flatMap<[string, boolean]>(({ label }, index) =>
        label === undefined ? [] : [[label, !chart.isDatasetVisible(index)]],
      ),
    )
  }

  #createChart(
    config: WidgetChartConfig,
    hiddenByLabel: ReadonlyMap<string, boolean>,
  ): void {
    const container = getDiv('chart')
    container.style.height = `${String(this.#height)}px`
    const canvas = document.createElement('canvas')
    container.replaceChildren(canvas)
    const chart = new Chart(canvas, config)
    this.#chart = chart
    if (config.type === 'pie') {
      applyPieHiddenByLabel(chart, config, hiddenByLabel)
    }
  }

  // Never rejects: `init()` awaits the first draw, so a transient failure
  // must neither block `homey.ready()` nor stop the auto-refresh loop —
  // the timer rearmed in `finally` retries it.
  async #draw(): Promise<void> {
    try {
      await this.#refreshChart()
      await this.#homey.setHeight(document.body.scrollHeight)
    } catch (error) {
      // Surfaces in the widget dev tools; the rearmed timer retries.
      surfaceError(new Error('Chart refresh failed', { cause: error }))
    } finally {
      // A picker change can start a second draw while this one is in
      // flight; clearing the tracked timer here collapses both chains back
      // into one instead of leaving an orphaned timer refreshing forever.
      if (this.#timeout !== null) {
        clearTimeout(this.#timeout)
      }
      this.#timeout = setTimeout(() => {
        fireAndForget(this.#draw())
      }, getTimeout(this.#getChart()))
    }
  }

  async #fetchDevices(
    type?: Classic.DeviceType,
  ): Promise<Classic.DeviceZone[]> {
    const typeQuery =
      type === undefined ? '' : (
        `?${new URLSearchParams({ type: String(type) })}`
      )
    return homeyApiGet<Classic.DeviceZone[]>(
      this.#homey,
      `/classic/devices${typeQuery}`,
    )
  }

  // Resolves to null when a picker change landed while the fetch was in
  // flight: the response is stale, and the change listener's own draw
  // renders the new selection.
  async #fetchFreshConfig(): Promise<WidgetChartConfig | null> {
    const selection = this.#readSelection()
    const config = getChartConfig(await fetchChartData(this.#homey, selection))
    return isSameSelection(selection, this.#readSelection()) ? config : null
  }

  // The picker only ever holds ids from `CHARTS`; the fallback is
  // type-level only.
  #getChart(): HomeySettings['default_chart'] {
    const { value } = this.#chartSelect
    return isChart(value) ? value : 'operation_modes'
  }

  async #initControls(): Promise<void> {
    const [devices, atwDevices] = await Promise.all([
      this.#fetchDevices(),
      this.#fetchDevices(ClassicDeviceType.Atw),
    ])
    if (devices.length > 0) {
      this.#populateChartOptions(atwDevices.length > 0)
      this.#populateDayOptions()
      const devicesForChart = (): Classic.DeviceZone[] =>
        this.#getChart() === 'hourly_temperatures' ? atwDevices : devices
      this.#repopulateZoneOptions(devicesForChart())
      this.#addEventListeners(devicesForChart)
      await this.#draw()
    }
  }

  // ATW-only charts are omitted when no ATW device exists; the picker then
  // falls back to its first option if the configured default was omitted.
  #populateChartOptions(hasAtwDevices: boolean): void {
    for (const chart of CHARTS) {
      if (chart !== 'hourly_temperatures' || hasAtwDevices) {
        createOption(this.#chartSelect, {
          id: chart,
          label: this.#homey.__(`widgets.charts.${chart}`),
        })
      }
    }
    applySelectValue(this.#chartSelect, this.#defaultChart)
  }

  #populateDayOptions(): void {
    const formatter = new Intl.NumberFormat(document.documentElement.lang, {
      style: 'unit',
      unit: 'day',
      unitDisplay: 'long',
    })
    for (const days of getDayValues(this.#defaultDays)) {
      createOption(this.#daySelect, {
        id: String(days),
        label: formatter.format(days),
      })
    }
    applySelectValue(this.#daySelect, String(this.#defaultDays))
    this.#syncDayVisibility()
  }

  #readSelection(): ChartSelection {
    return {
      chart: this.#getChart(),
      days: Number(this.#daySelect.value),
      zoneValue: getZonePath(this.#zoneSelect.value),
    }
  }

  #redraw(): void {
    if (this.#timeout !== null) {
      clearTimeout(this.#timeout)
    }
    fireAndForget(this.#draw())
  }

  async #refreshChart(): Promise<void> {
    const config = await this.#fetchFreshConfig()
    if (config === null) {
      return
    }
    const hiddenByLabel = this.#captureHiddenByLabel()
    applyHiddenByLabel(config, hiddenByLabel)
    if (this.#shouldRecreateChart(config)) {
      this.#chart?.destroy()
      this.#chart = null
    }
    this.#config = config
    this.#renderOrUpdateChart(config, hiddenByLabel)
  }

  #renderOrUpdateChart(
    config: WidgetChartConfig,
    hiddenByLabel: ReadonlyMap<string, boolean>,
  ): void {
    if (this.#chart === null) {
      this.#createChart(config, hiddenByLabel)
      return
    }
    this.#chart.data = config.data
    this.#chart.options = config.options
    this.#chart.update()
  }

  // The zone line-up depends on the selected chart (ATW-only for the hourly
  // temperatures), so the options are rebuilt on every chart change: the
  // previous selection wins, then the configured default, then the first
  // option as the final fallback.
  #repopulateZoneOptions(devices: readonly Classic.DeviceZone[]): void {
    const previous = this.#zoneSelect.value
    this.#zoneSelect.replaceChildren()
    for (const { id, model, name } of devices) {
      createOption(this.#zoneSelect, { id: getZoneId(id, model), label: name })
    }
    applySelectValue(this.#zoneSelect, previous)
    if (this.#zoneSelect.value !== previous) {
      this.#applyDefaultZone()
    }
  }

  // Verified against chart.umd.js in a headless browser: line-dataset legend
  // toggles live in metas keyed by dataset object identity, so they never
  // survive this widget's full-config refreshes and recreating buys nothing.
  // Pie slice toggles live in the chart-level, index-keyed `_hiddenIndices`,
  // which does survive in-place updates: recreate when the slice line-up
  // shifts so a stale index cannot hide the wrong slice. A type flip
  // (line <-> pie, reachable from the chart picker) always recreates:
  // a live Chart.js instance keeps the type it was constructed with.
  #shouldRecreateChart({ data, type }: WidgetChartConfig): boolean {
    if (this.#config === null) {
      return false
    }
    if (type !== this.#config.type) {
      return true
    }
    if (type !== 'pie') {
      return false
    }
    const previous = this.#config.data.labels ?? []
    const next = data.labels ?? []
    return (
      previous.length !== next.length ||
      previous.some((label, index) => label !== next[index])
    )
  }

  // The day count only applies to the daily aggregate charts; the picker
  // hides for the hourly ones.
  #syncDayVisibility(): void {
    this.#daySelect.hidden = !chartsWithDays.has(this.#getChart())
  }
}

// ── Entry point ──

const onHomeyReady = async (homey: Homey<HomeySettings>): Promise<void> => {
  const widget = new ChartWidget(homey)
  await widget.init()
}

Object.assign(globalThis, { onHomeyReady })
