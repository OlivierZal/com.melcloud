import type { ReportChartLineOptions } from '@olivierzal/melcloud-api'
import type ApexCharts from 'apexcharts'
import type HomeyWidget from 'homey/lib/HomeyWidget'

import type { DaysQuery, DeviceZone } from '../../../types/common.mts'

declare interface Homey extends HomeyWidget {
  getSettings: () => HomeySettings
}

interface HomeySettings extends Partial<Record<string, unknown>> {
  days: number
  default_zone: DeviceZone | null
}

const FONT_SIZE_SMALL = '12px'
const COLOR_GREY = '#E4E4E4'

const INCREMENT = 1
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

let settings: HomeySettings = { days: 1, default_zone: null }
let chart: ApexCharts | null = null

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`
const getZonePath = (): string => zoneElement.value.replace('_', '/')

const getTemperatures = async (homey: Homey): Promise<ReportChartLineOptions> =>
  (await homey.api(
    'GET',
    `/logs/temperatures/${getZonePath()}?${new URLSearchParams({
      days: String(settings.days),
    } satisfies DaysQuery)}`,
  )) as ReportChartLineOptions

const getStyle = (value: string): string =>
  getComputedStyle(document.documentElement).getPropertyValue(value).trim()

const getOptions = async (homey: Homey): Promise<ApexCharts.ApexOptions> => {
  const { labels, series, unit } = await getTemperatures(homey)
  const colorLight = getStyle('--homey-text-color-light')
  const fontStyle = {
    fontSize: FONT_SIZE_SMALL,
    fontWeight: getStyle('--homey-font-weight-regular'),
  }
  return {
    chart: { height: 400, toolbar: { show: false }, type: 'line' },
    grid: {
      borderColor: COLOR_GREY,
      strokeDashArray: 3,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    legend: { ...fontStyle, labels: { colors: colorLight } },
    series,
    stroke: { curve: 'smooth', width: 2 },
    title: {
      align: 'left',
      offsetX: 5,
      style: { ...fontStyle, color: colorLight },
      text: unit,
    },
    xaxis: {
      axisBorder: { color: COLOR_GREY, show: true },
      axisTicks: { show: true },
      categories: labels,
      labels: {
        rotate: 0,
        rotateAlways: false,
        style: { ...fontStyle, colors: colorLight },
      },
      tickAmount: 4,
    },
    yaxis: {
      axisBorder: { color: COLOR_GREY, show: true },
      axisTicks: { show: true },
      labels: {
        formatter: (value): string => value.toFixed(),
        style: { ...fontStyle, colors: colorLight },
      },
    },
  }
}

const draw = async (homey: Homey): Promise<void> => {
  const options = await getOptions(homey)
  if (chart) {
    await chart.updateOptions(options)
  } else {
    // @ts-expect-error: imported by another script in `./index.html`
    chart = new ApexCharts(getDivElement('chart'), options)
    await chart.render()
  }
  const now = new Date()
  const next = new Date(now)
  next.setHours(next.getHours() + INCREMENT, TIME_FIVE, TIME_ZERO, TIME_ZERO)
  setTimeout(() => {
    draw(homey).catch(() => {
      //
    })
  }, next.getTime() - now.getTime())
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
  const devices = (await homey.api('GET', '/devices')) as DeviceZone[]
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
