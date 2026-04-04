import type {
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type ApexCharts from 'apexcharts'

import type {
  DaysQuery,
  DeviceZone,
  ChartsWidgetSettings as HomeySettings,
} from '../../../types/index.mts'
import { DeviceType } from './constants.mts'
import { createOption, getDiv, getSelect } from './dom.mts'
import { type Homey, homeyApiGet, setDocumentLanguage } from './homey-api.mts'
import { getZoneId, getZonePath } from './zones.mts'

// Below --homey-font-size-small (14px) — intentional for compact chart labels
const FONT_SIZE_VERY_SMALL = '12px'
const NEXT_TIMEOUT = 60_000
const AGGREGATION_DELAY_MINUTES = 5

const chartsWithDays = new Set<HomeySettings['chart']>([
  'operation_modes',
  'temperatures',
])
const hourlyCharts = new Set<HomeySettings['chart']>([
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

let myChart: ApexCharts | null = null
let options: ApexCharts.ApexOptions = {}
let timeout: NodeJS.Timeout | null = null

// ── DOM helpers ──

const zone = getSelect('zones')
const getZoneValue = (): string => getZonePath(zone.value)

// ── Style helpers ──

const getStyle = (property: string): string => {
  styleCache[property] ??= getComputedStyle(document.documentElement)
    .getPropertyValue(property)
    .trim()
  return styleCache[property]
}

const normalizeSeriesName = (name: string): string =>
  name.replace('Temperature', '')

// ── Shared chart config ──

const getBaseChartConfig = (
  height: number,
  type: 'line' | 'pie',
): ApexCharts.ApexOptions['chart'] => ({
  height,
  toolbar: { show: false },
  type,
})

const getLegendConfig = (): ApexCharts.ApexOptions['legend'] => ({
  fontSize: FONT_SIZE_VERY_SMALL,
  fontWeight: getStyle('--homey-font-weight-regular'),
  labels: { colors: getStyle('--homey-text-color-light') },
  markers: { shape: 'square', strokeWidth: 0 },
})

// ── Chart options ──

const getChartLineOptions = (
  { labels: categories, series, unit }: ReportChartLineOptions,
  height: number,
): ApexCharts.ApexOptions => {
  const colorLight = getStyle('--homey-text-color-light')
  const axisColor = { color: colorLight, show: true }
  const axisStyle = { axisBorder: axisColor, axisTicks: axisColor }
  const fontStyle = {
    fontSize: FONT_SIZE_VERY_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
  }
  const style = { ...fontStyle, colors: colorLight }
  return {
    chart: getBaseChartConfig(height, 'line'),
    colors,
    grid: {
      borderColor: colorLight,
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
    },
    legend: { ...getLegendConfig(), ...fontStyle },
    series: series.map(({ data, name: seriesName }) => {
      const name = normalizeSeriesName(seriesName)
      return { data, hidden: hidden.has(name), name }
    }),
    stroke: { curve: 'smooth' },
    title: {
      offsetX: 5,
      style: { ...fontStyle, color: colorLight },
      text: unit,
    },
    xaxis: {
      ...axisStyle,
      categories,
      labels: { rotate: 0, style },
      tickAmount: 3,
    },
    yaxis: {
      ...axisStyle,
      labels: { style, formatter: (value) => value.toFixed(0) },
      ...(unit === 'dBm' ? { max: 0, min: -100 } : undefined),
    },
  }
}

const getChartPieOptions = (
  { labels, series }: ReportChartPieOptions,
  height: number,
): ApexCharts.ApexOptions => ({
  chart: getBaseChartConfig(height, 'pie'),
  colors,
  dataLabels: {
    dropShadow: { enabled: false },
    style: {
      colors: [getStyle('--homey-text-color')],
      fontSize: getStyle('--homey-font-size-small'),
      fontWeight: getStyle('--homey-font-weight-bold'),
    },
  },
  /*
   * Clean up MELCloud operation mode labels for display
   * (e.g., 'CoolingMode' -> 'Cooling')
   */
  labels: labels.map((label) =>
    label
      .replace('Actual', '')
      .replace('FansStopped', 'Stop')
      .replace('Mode', '')
      .replace('Operation', '')
      .replace('PowerOff', 'Off')
      .replace('Power', 'Off')
      .replace('Prevention', '')
      .replace(/(?<mode>.+)Ventilation$/u, '$<mode>'),
  ),
  legend: getLegendConfig(),
  series,
  stroke: { show: false },
})

const getChartOptions = (
  data: ReportChartLineOptions | ReportChartPieOptions,
  height: number,
): ApexCharts.ApexOptions =>
  'unit' in data ?
    getChartLineOptions(data, height)
  : getChartPieOptions(data, height)

// ── Chart data fetching ──

const fetchChartData = async (
  homey: Homey,
  chart: HomeySettings['chart'],
  days?: number,
): Promise<ReportChartLineOptions | ReportChartPieOptions> => {
  const daysQuery =
    chartsWithDays.has(chart) && days !== undefined ?
      `?${new URLSearchParams({ days: String(days) } satisfies DaysQuery)}`
    : ''
  return homeyApiGet<ReportChartLineOptions | ReportChartPieOptions>(
    homey,
    `/${getZoneValue()}/logs/${chart.replaceAll('_', '-')}${daysQuery}`,
  )
}

const handleChartAndOptions = async (
  homey: Homey,
  {
    chart,
    days,
    height,
  }: { chart: HomeySettings['chart']; height: number; days?: number },
): Promise<ApexCharts.ApexOptions> => {
  /*
   * Preserve user's hidden series selections across data refreshes. If chart
   * type changes or a previously hidden series disappears, destroy and
   * recreate the chart
   */
  const hiddenSeries = (options.series ?? []).map((serie) =>
    typeof serie === 'number' || serie.hidden !== true ? null : serie.name,
  )
  const newOptions = getChartOptions(
    await fetchChartData(homey, chart, days),
    height,
  )
  const shouldRecreateChart =
    newOptions.chart?.type === 'pie' ||
    hiddenSeries.some(
      (name) =>
        name !== null &&
        !(newOptions.series ?? [])
          .map((serie) => (typeof serie === 'number' ? null : serie.name))
          .includes(name),
    )
  if (shouldRecreateChart) {
    myChart?.destroy()
    myChart = null
  }
  return newOptions
}

/*
 * Daily charts refresh 5 minutes after each full hour (to allow data
 * aggregation). Hourly charts refresh every 60 seconds
 */
const getTimeout = (chart: HomeySettings['chart']): number => {
  if (hourlyCharts.has(chart)) {
    return NEXT_TIMEOUT
  }
  const now = new Date()
  const next = new Date(now)
  next.setHours(next.getHours() + 1, AGGREGATION_DELAY_MINUTES, 0, 0)
  return next.getTime() - now.getTime()
}

const draw = async (
  homey: Homey,
  {
    chart,
    days,
    height,
  }: { chart: HomeySettings['chart']; height: number; days?: number },
): Promise<void> => {
  options = await handleChartAndOptions(homey, { chart, days, height })
  if (myChart) {
    await myChart.updateOptions(options)
  } else {
    // @ts-expect-error: imported by another script in `./index.html`
    myChart = new ApexCharts(getDiv('chart'), options)
    await myChart.render()
  }
  await homey.setHeight(document.body.scrollHeight)
  timeout = setTimeout(() => {
    draw(homey, { chart, days, height }).catch(() => {
      // Best-effort: chart will retry on next scheduled refresh
    })
  }, getTimeout(chart))
}

// ── Setup ──

const generateZones = (zones: DeviceZone[]): void => {
  for (const { id, model, name: label } of zones) {
    createOption(zone, { id: getZoneId(id, model), label })
  }
}

const addEventListeners = (
  homey: Homey,
  config: { chart: HomeySettings['chart']; height: number; days?: number },
): void => {
  zone.addEventListener('change', () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    draw(homey, config).catch(() => {
      // Best-effort: chart will retry on next zone change or refresh
    })
  })
}

const handleDefaultZone = (defaultZone: DeviceZone | null): void => {
  if (!defaultZone) {
    return
  }
  const { id, model } = defaultZone
  const value = getZoneId(id, model)
  if (document.querySelector(`#zones option[value="${value}"]`)) {
    zone.value = value
  }
}

const fetchDevices = async (homey: Homey<HomeySettings>): Promise<void> => {
  const { chart, days, default_zone: defaultZone, height } = homey.getSettings()
  const typeQuery =
    chart === 'hourly_temperatures' ?
      `?${new URLSearchParams({ type: String(DeviceType.Atw) })}`
    : ''
  const devices = await homeyApiGet<DeviceZone[]>(homey, `/devices${typeQuery}`)
  if (devices.length > 0) {
    addEventListeners(homey, { chart, days, height: Number(height) })
    generateZones(devices)
    handleDefaultZone(defaultZone)
    await draw(homey, { chart, days, height: Number(height) })
  }
}

const onHomeyReady = async (homey: Homey<HomeySettings>): Promise<void> => {
  await setDocumentLanguage(homey)
  await fetchDevices(homey)
  homey.ready({ height: document.body.scrollHeight })
}

Object.assign(globalThis, { onHomeyReady })
