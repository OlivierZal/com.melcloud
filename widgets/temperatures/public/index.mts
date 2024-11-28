import type { TemperatureLog } from '@olivierzal/melcloud-api'
// eslint-disable-next-line import/no-namespace
import type * as echarts from 'echarts'
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

const getZonePath = (): string => zoneElement.value.replace('_', '/')

const getTemperatures = async (homey: Homey): Promise<TemperatureLog> =>
  (await homey.api(
    'GET',
    `/logs/temperatures/${getZonePath()}?${new URLSearchParams({
      days: String(settings.days),
    } satisfies DaysQuery)}`,
  )) as TemperatureLog

// @ts-expect-error: see `./echarts.min.js`
const myChart = echarts.init(getDivElement('temperatures'))

const draw = async (homey: Homey): Promise<void> => {
  myChart.clear()
  const { legend, series, xAxis } = await getTemperatures(homey)
  const option = {
    legend: { bottom: 0, data: legend, type: 'scroll' },
    series: series.map((serie, index) => ({
      data: serie,
      name: legend[index],
      symbol: 'none',
      type: 'line',
    })),
    xAxis: { data: xAxis },
    yAxis: {},
  }
  myChart.setOption(option)
}

const setDocumentLanguage = async (homey: Homey): Promise<void> => {
  try {
    const language = await homey.api('GET', '/language')
    document.documentElement.lang =
      typeof language === 'string' ? language : 'en'
  } catch {}
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
  try {
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
  } catch {}
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
