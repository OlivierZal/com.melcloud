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
const HEIGHT = 300
const INCREMENT = 1
const NEXT_TIMEOUT = 60000
const TIME_ZERO = 0
const TIME_FIVE = 5

const styleCache: Record<string, string> = {}

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

let myChart: ApexCharts | null = null
let timeout: NodeJS.Timeout | null = null

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

// eslint-disable-next-line max-lines-per-function
const getChartLineOptions = ({
  labels,
  series,
  unit,
}: ReportChartLineOptions): ApexCharts.ApexOptions => {
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
    chart: { height: HEIGHT, toolbar: { show: false }, type: 'line' },
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
    series: series.map(({ data, name }) => ({
      data,
      hidden:
        name.startsWith('Mixing') ||
        name.startsWith('FlowTemperatureZone') ||
        name.startsWith('ReturnTemperatureZone') ||
        name.endsWith('Boiler'),
      name: name.replace('Temperature', ''),
    })),
    stroke: { curve: 'smooth', width: 2 },
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

const getChartPieOptions = ({
  labels,
  series,
}: ReportChartPieOptions): ApexCharts.ApexOptions => ({
  chart: { height: HEIGHT, toolbar: { show: false }, type: 'pie' },
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
      .replace(/(?<mode>.+)Ventilation$/u, '$<mode>'),
  ),
  legend: {
    fontSize: FONT_SIZE_VERY_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
    labels: { colors: getStyle('--homey-text-color-light') },
    markers: { shape: 'square', strokeWidth: 0 },
    position: 'bottom',
  },
  series,
  stroke: { show: false },
})

const getChartOptions = (
  data: ReportChartLineOptions | ReportChartPieOptions,
): ApexCharts.ApexOptions =>
  'unit' in data ? getChartLineOptions(data) : getChartPieOptions(data)

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

const draw = async (
  homey: Homey,
  chart: HomeySettings['chart'],
  days?: number,
): Promise<void> => {
  const options = getChartOptions(await getChartFunction(homey, chart)(days))
  if (myChart) {
    await myChart.updateOptions(options)
    await homey.setHeight(document.body.scrollHeight)
  } else {
    // @ts-expect-error: imported by another script in `./index.html`
    myChart = new ApexCharts(getDivElement('chart'), options)
    await myChart.render()
  }
  const now = new Date()
  const next = new Date(now)
  next.setHours(next.getHours() + INCREMENT, TIME_FIVE, TIME_ZERO, TIME_ZERO)
  timeout = setTimeout(
    () => {
      draw(homey, chart, days).catch(() => {
        //
      })
    },
    ['hourly_temperatures', 'signal'].includes(chart) ? NEXT_TIMEOUT : (
      next.getTime() - now.getTime()
    ),
  )
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
  chart: HomeySettings['chart'],
  days?: number,
): void => {
  zoneElement.addEventListener('change', () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    draw(homey, chart, days).catch(() => {
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
  const { chart, days, default_zone: defaultZone } = homey.getSettings()
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
    addEventListeners(homey, chart, days)
    generateZones(devices)
    handleDefaultZone(defaultZone)
    await draw(homey, chart, days)
  }
}

const initStyles = (): void => {
  ;[
    '--homey-font-weight-bold',
    '--homey-font-weight-regular',
    '--homey-text-color',
    '--homey-text-color-light',
  ].forEach((style) => {
    styleCache[style] = getComputedStyle(document.documentElement)
      .getPropertyValue(style)
      .trim()
  })
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  initStyles()
  await setDocumentLanguage(homey)
  await fetchDevices(homey)
  homey.ready({ height: document.body.scrollHeight })
}
