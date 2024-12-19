import type {
  DeviceType,
  ReportChartLineOptions,
  ReportChartPieOptions,
} from '@olivierzal/melcloud-api'
import type ApexCharts from 'apexcharts'
import type HomeyWidget from 'homey/lib/HomeyWidget'

import type {
  DaysQuery,
  DeviceZone,
  HomeyWidgetSettingsCharts as HomeySettings,
} from '../../../types/common.mts'

declare interface Homey extends HomeyWidget {
  getSettings: () => HomeySettings
}

const FONT_SIZE_SMALL = '14px'
const FONT_SIZE_VERY_SMALL = '12px'
const INCREMENT = 1
const NEXT_TIMEOUT = 60000
const TIME_ZERO = 0
const TIME_FIVE = 5

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
const defaultHiddenSeries = [
  'FlowBoiler',
  'FlowZone1',
  'FlowZone2',
  'MixingTankWater',
  'ReturnBoiler',
  'ReturnZone1',
  'ReturnZone2',
]
const styleCache: Record<string, string> = {}

let myChart: ApexCharts | null = null
let options: ApexCharts.ApexOptions = {}
let timeout: NodeJS.Timeout | null = null

const getDivElement = (id: string): HTMLDivElement => {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLDivElement)) {
    throw new Error('Element is not a div')
  }
  return element
}

const getSelectElement = (id: string): HTMLSelectElement => {
  const element = document.getElementById(id)
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error('Element is not a select')
  }
  return element
}

const zoneElement = getSelectElement('zones')

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`
const getZonePath = (): string => zoneElement.value.replace('_', '/')

const getStyle = (property: string): string => {
  if (!styleCache[property]) {
    styleCache[property] = getComputedStyle(document.documentElement)
      .getPropertyValue(property)
      .trim()
  }
  return styleCache[property]
}

const normalizeSeriesName = (name: string): string =>
  name.replace('Temperature', '')

// eslint-disable-next-line max-lines-per-function
const getChartLineOptions = (
  { labels, series, unit }: ReportChartLineOptions,
  height: number,
): ApexCharts.ApexOptions => {
  const colorLight = getStyle('--homey-text-color-light')
  const axisStyle = {
    axisBorder: { color: colorLight, show: true },
    axisTicks: { color: colorLight, show: true },
  }
  const fontStyle = {
    fontSize: FONT_SIZE_VERY_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
  }
  return {
    chart: { height, toolbar: { show: false }, type: 'line' },
    colors,
    grid: {
      borderColor: colorLight,
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
    },
    legend: {
      ...fontStyle,
      labels: { colors: colorLight },
      markers: { shape: 'square', strokeWidth: 0 },
    },
    series: series.map(({ data, name }) => {
      const newName = normalizeSeriesName(name)
      return {
        data,
        hidden: defaultHiddenSeries.includes(newName),
        name: newName,
      }
    }),
    stroke: { curve: 'smooth' },
    title: {
      offsetX: 5,
      style: { ...fontStyle, color: colorLight },
      text: unit,
    },
    xaxis: {
      ...axisStyle,
      categories: labels,
      labels: { rotate: 0, style: { ...fontStyle, colors: colorLight } },
      tickAmount: 3,
    },
    yaxis: {
      ...axisStyle,
      labels: {
        formatter: (value): string => value.toFixed(),
        style: { ...fontStyle, colors: colorLight },
      },
      ...(unit === 'dBm' ? { max: 0, min: -100 } : undefined),
    },
  }
}

const getChartPieOptions = (
  { labels, series }: ReportChartPieOptions,
  height: number,
): ApexCharts.ApexOptions => ({
  chart: { height, toolbar: { show: false }, type: 'pie' },
  colors,
  dataLabels: {
    dropShadow: { enabled: false },
    style: {
      colors: [getStyle('--homey-text-color')],
      fontSize: FONT_SIZE_SMALL,
      fontWeight: getStyle('--homey-font-weight-bold'),
    },
  },
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
  legend: {
    fontSize: FONT_SIZE_VERY_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
    labels: { colors: getStyle('--homey-text-color-light') },
    markers: { shape: 'square', strokeWidth: 0 },
  },
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

const getChartFunction =
  (
    homey: Homey,
    chart: HomeySettings['chart'],
  ): ((
    days?: number,
  ) => Promise<ReportChartLineOptions | ReportChartPieOptions>) =>
  async (days?: number) =>
    (await homey.api(
      'GET',
      `/logs/${chart}/${getZonePath()}${
        (
          ['operation_modes', 'temperatures'].includes(chart) &&
          days !== undefined
        ) ?
          `?${new URLSearchParams({
            days: String(days),
          } satisfies DaysQuery)}`
        : ''
      }`,
    )) as Promise<ReportChartLineOptions | ReportChartPieOptions>

const handleChartAndOptions = async (
  homey: Homey,
  {
    chart,
    days,
    height,
  }: { chart: HomeySettings['chart']; height: number; days?: number },
): Promise<ApexCharts.ApexOptions> => {
  const hiddenSeries = (options.series ?? []).map((serie) =>
    typeof serie === 'number' || serie.hidden !== true ? null : serie.name,
  )
  const newOptions = getChartOptions(
    await getChartFunction(homey, chart)(days),
    height,
  )
  if (
    newOptions.chart?.type === 'pie' ||
    hiddenSeries.some(
      (name) =>
        name !== null &&
        !(newOptions.series ?? [])
          .map((serie) => (typeof serie === 'number' ? null : serie.name))
          .includes(name),
    )
  ) {
    myChart?.destroy()
    myChart = null
  }
  return newOptions
}

const getTimeout = (chart: HomeySettings['chart']): number => {
  if (['hourly_temperatures', 'signal'].includes(chart)) {
    return NEXT_TIMEOUT
  }
  const now = new Date()
  const next = new Date(now)
  next.setHours(next.getHours() + INCREMENT, TIME_FIVE, TIME_ZERO, TIME_ZERO)
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
    myChart = new ApexCharts(getDivElement('chart'), options)
    await myChart.render()
  }
  await homey.setHeight(document.body.scrollHeight)
  timeout = setTimeout(() => {
    draw(homey, { chart, days, height }).catch(() => {
      //
    })
  }, getTimeout(chart))
}

const setDocumentLanguage = async (homey: Homey): Promise<void> => {
  document.documentElement.lang = (await homey.api(
    'GET',
    '/language',
  )) as string
}

const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!selectElement.querySelector(`option[value="${id}"]`)) {
    selectElement.append(new Option(label, id))
  }
}

const generateZones = (zones: DeviceZone[]): void => {
  zones.forEach(({ id, model, name: label }) => {
    createOptionElement(zoneElement, { id: getZoneId(id, model), label })
  })
}

const addEventListeners = (
  homey: Homey,
  config: { chart: HomeySettings['chart']; height: number; days?: number },
): void => {
  zoneElement.addEventListener('change', () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    draw(homey, config).catch(() => {
      //
    })
  })
}

const handleDefaultZone = (defaultZone: DeviceZone | null): void => {
  if (defaultZone) {
    const { id, model } = defaultZone
    const value = getZoneId(id, model)
    if (document.querySelector(`#zones option[value="${value}"]`)) {
      zoneElement.value = value
    }
  }
}

const fetchDevices = async (homey: Homey): Promise<void> => {
  const { chart, days, default_zone: defaultZone, height } = homey.getSettings()
  const devices = (await homey.api(
    'GET',
    `/devices${
      chart === 'hourly_temperatures' ?
        `?${new URLSearchParams({
          type: '1',
        } satisfies { type: `${DeviceType}` })}`
      : ''
    }`,
  )) as DeviceZone[]
  if (devices.length) {
    addEventListeners(homey, { chart, days, height: Number(height) })
    generateZones(devices)
    handleDefaultZone(defaultZone)
    await draw(homey, { chart, days, height: Number(height) })
  }
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  await setDocumentLanguage(homey)
  await fetchDevices(homey)
  homey.ready({ height: document.body.scrollHeight })
}
