import type { TemperatureLog } from '@olivierzal/melcloud-api'
import type ApexCharts from 'apexcharts'
import type HomeyWidget from 'homey/lib/HomeyWidget'

import type { BaseZone, DaysQuery } from '../../../types/common.mts'

declare interface Homey extends HomeyWidget {
  getSettings: () => HomeySettings
}

interface HomeySettings extends Partial<Record<string, unknown>> {
  days: number
  default_zone: BaseZone | null
}

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

const getZonePath = (): string => zoneElement.value.replace('_', '/')

const getTemperatures = async (homey: Homey): Promise<TemperatureLog> =>
  (await homey.api(
    'GET',
    `/logs/temperatures/${getZonePath()}?${new URLSearchParams({
      days: String(settings.days),
    } satisfies DaysQuery)}`,
  )) as TemperatureLog

const draw = async (homey: Homey): Promise<void> => {
  const { labels: categories, series } = await getTemperatures(homey)
  const options = {
    chart: { height: 400, toolbar: { show: false }, type: 'line' },
    series,
    xaxis: { categories },
    yaxis: { labels: { formatter: (value): string => value.toFixed() } },
  } satisfies ApexCharts.ApexOptions
  if (!chart) {
    // @ts-expect-error: imported by another script in `./index.html`
    chart = new ApexCharts(getDivElement('temperatures'), options)
    await chart.render()
    return
  }
  await chart.updateOptions(options)
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
  if (
    !selectElement.querySelector<HTMLOptionElement>(`option[value="${id}"]`)
  ) {
    selectElement.append(new Option(label, id))
  }
}

const generateZones = (zones: BaseZone[]): void => {
  zones.forEach(({ id, name: label }) => {
    createOptionElement(zoneElement, { id, label })
  })
}

const fetchDevices = async (homey: Homey): Promise<void> => {
  const devices = (await homey.api('GET', '/devices')) as BaseZone[]
  if (devices.length) {
    generateZones(devices)
    if (settings.default_zone) {
      ;({
        default_zone: { id: zoneElement.value },
      } = settings)
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
