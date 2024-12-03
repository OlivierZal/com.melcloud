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

const FONT_SIZE_SMALL = '12px'
const HEIGHT = 400
const INCREMENT = 1
const NEXT_TIMEOUT = 60000
const TIME_ZERO = 0
const TIME_FIVE = 5

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

let timeout: NodeJS.Timeout | null = null

let settings: HomeySettings = {
  chart: 'operation_modes',
  days: 1,
  default_zone: null,
}
let myChart: ApexCharts | null = null

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`
const getZonePath = (): string => zoneElement.value.replace('_', '/')

const getReportChartOptions =
  (
    chart: HomeySettings['chart'],
  ): ((
    homey: Homey,
  ) => Promise<ReportChartLineOptions | ReportChartPieOptions>) =>
  async (homey: Homey) =>
    (await homey.api(
      'GET',
      `/logs/${String(chart)}/${getZonePath()}${
        ['operation_modes', 'temperatures'].includes(chart) ?
          `?${new URLSearchParams({
            days: String(settings.days),
          } satisfies DaysQuery)}`
        : ''
      }`,
    )) as Promise<ReportChartLineOptions | ReportChartPieOptions>

const getStyle = (value: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(value).trim()

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
    fontSize: FONT_SIZE_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
  }
  return {
    chart: { height: HEIGHT, toolbar: { show: false }, type: 'line' },
    grid: {
      borderColor: colorLight,
      padding: { right: 5 },
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
    },
    legend: {
      ...fontStyle,
      horizontalAlign: 'left',
      itemMargin: { horizontal: 10, vertical: 0 },
      labels: { colors: colorLight },
      markers: { shape: 'square' },
    },
    series: series.map(({ data, name }) => ({
      data,
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
      tickAmount: 4,
    },
    yaxis: {
      ...axisStyle,
      labels: {
        formatter: (value): string => value.toFixed(),
        style: { ...fontStyle, colors: colorLight },
      },
    },
  }
}

const getChartPieOptions = (
  data: ReportChartPieOptions,
): ApexCharts.ApexOptions => {
  const colorLight = getStyle('--homey-text-color-light')
  const fontStyle = {
    fontSize: FONT_SIZE_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
  }
  return {
    ...data,
    chart: { height: HEIGHT, toolbar: { show: false }, type: 'pie' },
    legend: {
      ...fontStyle,
      labels: { colors: colorLight },
      markers: { shape: 'square' },
    },
  }
}

const getChartOptions = async (
  homey: Homey,
  chartFunction: (
    homey: Homey,
  ) => Promise<ReportChartLineOptions | ReportChartPieOptions>,
): Promise<ApexCharts.ApexOptions> => {
  const data = await chartFunction(homey)
  return 'unit' in data ? getChartLineOptions(data) : getChartPieOptions(data)
}

const draw = async (homey: Homey): Promise<void> => {
  const options = await getChartOptions(
    homey,
    getReportChartOptions(settings.chart),
  )
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
      draw(homey).catch(() => {
        //
      })
    },
    ['hourly_temperatures', 'signal'].includes(settings.chart) ? NEXT_TIMEOUT
    : next.getTime() - now.getTime(),
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

const fetchDevices = async (homey: Homey): Promise<void> => {
  const devices = (await homey.api(
    'GET',
    `/devices${
      settings.chart === 'hourly_temperatures' ?
        `?${new URLSearchParams({
          type: '1',
        } satisfies { type: `${DeviceType}` })}`
      : ''
    }`,
  )) as DeviceZone[]
  if (devices.length) {
    generateZones(devices)
    if (settings.default_zone) {
      const {
        default_zone: { id, model },
      } = settings
      const value = getZoneId(id, model)
      if (document.querySelector(`#zones option[value="${value}"]`)) {
        zoneElement.value = value
      }
    }
    await draw(homey)
  }
}

const addEventListeners = (homey: Homey): void => {
  zoneElement.addEventListener('change', () => {
    if (timeout) {
      clearTimeout(timeout)
    }
    draw(homey).catch(() => {
      //
    })
  })
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  settings = homey.getSettings()
  await setDocumentLanguage(homey)
  await fetchDevices(homey)
  addEventListeners(homey)
  homey.ready({ height: document.body.scrollHeight })
}
