// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import { readFileSync } from 'node:fs'

import type * as ChartJs from 'chart.js'
import type { ChartConfiguration, Plugin as ChartPlugin } from 'chart.js'
import { getDiv, getSelect } from '@olivierzal/homey-kit/dom'
import { Temporal } from 'temporal-polyfill'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Homey } from '../../public/widget.mts'
import type { ChartsWidgetSettings } from '../../types/widgets.mts'
import { ChartArcElement } from '../chart-arc.ts'
import { mock, settleDetached } from '../helpers.ts'

// ── Chart.js stand-in ──
// The real library needs a painting canvas happy-dom does not provide.
// The fake records every construction, exposes the instance API the
// widget drives, and lets a test run the widget's own plugins against a
// recording 2D context.

interface FakeContext {
  readonly fillRect: ReturnType<typeof vi.fn<() => void>>
  fillStyle: string
  readonly fillText: ReturnType<typeof vi.fn<() => void>>
  font: string
  readonly restore: ReturnType<typeof vi.fn<() => void>>
  readonly save: ReturnType<typeof vi.fn<() => void>>
  textAlign: string
  textBaseline: string
}

const createContext = (): FakeContext => ({
  fillRect: vi.fn<() => void>(),
  fillStyle: '',
  fillText: vi.fn<() => void>(),
  font: '',
  restore: vi.fn<() => void>(),
  save: vi.fn<() => void>(),
  textAlign: '',
  textBaseline: '',
})

class FakeChart {
  // Indexed so the shared `mock` helper accepts the instance itself:
  // the plugins look their bands up by chart identity, so a spread
  // copy would silently lose them.
  readonly [key: string]: unknown

  public static readonly defaults = { font: { family: '' } }

  public static readonly instances: FakeChart[] = []

  public static readonly register = vi.fn<() => void>()

  public readonly chartArea = { bottom: 100, left: 0, right: 200, top: 0 }

  public readonly config: ChartConfiguration

  public readonly ctx = createContext()

  public data: ChartConfiguration['data']

  public readonly destroy = vi.fn<() => void>()

  public readonly hiddenDatasets = new Set<number>()

  public readonly hiddenPoints = new Set<number>()

  public readonly meta: { data: ChartArcElement[] } = { data: [] }

  public options: ChartConfiguration['options']

  public readonly scales: Record<
    string,
    { getPixelForValue: (value: number) => number } | undefined
  > = { xAxis: { getPixelForValue: (value: number): number => value * 10 } }

  public readonly toggled: number[] = []

  public readonly update = vi.fn<() => void>()

  public constructor(_canvas: HTMLCanvasElement, config: ChartConfiguration) {
    this.config = config
    this.data = config.data
    this.options = config.options
    FakeChart.instances.push(this)
  }

  public readonly getDatasetMeta = (): { data: ChartArcElement[] } => this.meta

  public readonly getDataVisibility = (index: number): boolean =>
    !this.hiddenPoints.has(index)

  public readonly isDatasetVisible = (index: number): boolean =>
    !this.hiddenDatasets.has(index)

  public readonly toggleDataVisibility = (index: number): void => {
    this.toggled.push(index)
    if (this.hiddenPoints.has(index)) {
      this.hiddenPoints.delete(index)
      return
    }
    this.hiddenPoints.add(index)
  }
}

vi.mock(import('chart.js'), () =>
  mock<typeof ChartJs>({
    ArcElement: ChartArcElement,
    BarController: {},
    BarElement: {},
    CategoryScale: {},
    Chart: FakeChart,
    Legend: {},
    LinearScale: {},
    LineController: {},
    LineElement: {},
    PieController: {},
    PointElement: {},
    Title: {},
    Tooltip: {},
  }),
)

const { start } = await import('../../widgets/charts/public/index.mts')

// ── Page ──

const chartsHtml = readFileSync('widgets/charts/public/index.html', 'utf8')

const loadChartsPage = (): void => {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(chartsHtml, 'text/html')
  document.head.replaceChildren(...parsed.head.children)
  document.body.replaceChildren(...parsed.body.children)
}

// ── Fixtures ──

const device = (
  id: number | string,
  name: string,
  model = 'devices',
): unknown => ({ id, level: 1, model, name })

const lineOptions = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  from: '2026-07-01',
  labels: ['Mon', 'Tue', 'Wed'],
  series: [{ data: [1, 2, 3], name: 'RoomTemperature' }],
  to: '2026-07-03',
  unit: '°C',
  ...overrides,
})

const pieOptions = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  from: '2026-07-01',
  labels: ['Heating', 'HotWater'],
  series: [3, 1],
  to: '2026-07-03',
  ...overrides,
})

const defaultRoutes = (): Record<string, unknown> => ({
  'GET /classic/devices': [device(11, 'Bedroom'), device(12, 'Kitchen')],
  'GET /classic/devices?type=0': [device(11, 'Bedroom')],
  'GET /classic/devices?type=1': [device(12, 'Kitchen')],
  'GET /home/devices': [device('h1', 'Attic', 'homeDevices')],
  'GET /home/devices?type=airToWater': [device('h1', 'Attic', 'homeDevices')],
  'GET /language': 'fr',
})

const withLogs = (routes = defaultRoutes()): Record<string, unknown> => ({
  ...routes,
  line: lineOptions(),
  pie: pieOptions(),
})

// ── Widget SDK ──

interface Harness {
  readonly api: ReturnType<
    typeof vi.fn<(method: string, path: string) => Promise<unknown>>
  >
  readonly homey: Homey<ChartsWidgetSettings>
  readonly ready: ReturnType<typeof vi.fn<() => void>>
  readonly setHeight: ReturnType<typeof vi.fn<() => Promise<void>>>
}

const createHarness = (
  options: {
    readonly failures?: Readonly<Record<string, Error>>
    readonly routes?: Record<string, unknown>
    readonly settings?: Partial<ChartsWidgetSettings>
  } = {},
): Harness => {
  const { failures = {}, routes = withLogs(), settings = {} } = options
  const api = vi
    .fn<(method: string, path: string) => Promise<unknown>>()
    .mockImplementation(async (method, path) => {
      await Promise.resolve()
      const key = `${method} ${path}`
      const failure = failures[key]
      if (failure !== undefined) {
        throw failure
      }
      if (path.includes('/logs/operation-modes')) {
        return routes.pie
      }
      if (path.includes('/logs/')) {
        return routes.line
      }
      return routes[key]
    })
  const ready = vi.fn<() => void>()
  const setHeight = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  return {
    api,
    homey: mock<Homey<ChartsWidgetSettings>>({
      api,
      ready,
      setHeight,
      __: (key: string): string => key,
      getSettings: (): ChartsWidgetSettings =>
        mock<ChartsWidgetSettings>({
          chart: 'temperatures',
          days: 7,
          default_zone: null,
          height: '400',
          ...settings,
        }),
      on: (): void => {
        // The charts widget subscribes to the freshness poke only.
      },
    }),
    ready,
    setHeight,
  }
}

const boot = async (
  options: Parameters<typeof createHarness>[0] = {},
): Promise<Harness> => {
  const harness = createHarness(options)
  await start(harness.homey)
  await settleDetached()
  return harness
}

const lastChart = (): FakeChart => {
  const chart = FakeChart.instances.at(-1)
  if (chart === undefined) {
    throw new TypeError('No chart was created')
  }
  return chart
}

const optionValues = (select: HTMLSelectElement): string[] =>
  [...select.options].map(({ value }) => value)

const commit = (select: HTMLSelectElement, value: string): void => {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

// `beforeDatasetsDraw` carries the cancelable flag in its ARGS (its
// second parameter); `afterDatasetsDraw` takes a bare object there and a
// trailing `false`. Calling through a union of both demands the
// intersection, so the args argument comes from the cancelable hook.
type CancelableArguments = Parameters<
  NonNullable<ChartPlugin['beforeDatasetsDraw']>
>

type HookArguments = Parameters<NonNullable<ChartPlugin['afterDatasetsDraw']>>

// The hooks read the live chart and its context; everything past that
// is renderer bookkeeping the widget's plugins never touch.
type PluginHook = 'afterDatasetsDraw' | 'beforeDatasetsDraw'

const runPlugin = (id: string, hook: PluginHook, chart: FakeChart): void => {
  // Called through the plugin rather than extracted: the hook keeps its
  // own `this`, as the renderer would give it.
  pluginOf(id)[hook]?.(
    mock<HookArguments[0]>(chart),
    mock<CancelableArguments[1] & HookArguments[1]>({ cancelable: true }),
    // The renderer's own draw options and trailing flag; the widget's
    // plugins never read either.
    mock<HookArguments[2]>(),
    mock<HookArguments[3]>(),
  )
}

const pluginOf = (id: string): ChartPlugin => {
  const plugin = lastChart().config.plugins?.find(
    (candidate) => candidate.id === id,
  )
  if (plugin === undefined) {
    throw new TypeError(`No \`${id}\` plugin on the built config`)
  }
  return plugin
}

describe('charts widget', () => {
  beforeEach(() => {
    sessionStorage.clear()
    loadChartsPage()
    // The Homey design tokens the charts read for their fonts: a
    // numeric weight and a keyword one, the two shapes the reader
    // handles.
    document.documentElement.style.setProperty(
      '--homey-font-weight-regular',
      '400',
    )
    document.documentElement.style.setProperty(
      '--homey-font-weight-bold',
      'bold',
    )
    FakeChart.instances.length = 0
    vi.stubGlobal('reportError', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should boot, populate every picker and draw once', async () => {
    const harness = await boot()

    expect(document.documentElement.lang).toBe('fr')
    expect(optionValues(getSelect('charts'))).toStrictEqual([
      'operation_modes',
      'temperatures',
      'hourly_temperatures',
      'signal',
      'report',
    ])
    expect(optionValues(getSelect('zones'))).toStrictEqual([
      'homeDevices_h1',
      'devices_11',
      'devices_12',
    ])
    expect(getSelect('charts').value).toBe('temperatures')
    expect(FakeChart.instances).toHaveLength(1)
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should build nothing without a single device', async () => {
    const harness = await boot({
      routes: withLogs({
        'GET /classic/devices': [],
        'GET /classic/devices?type=0': [],
        'GET /classic/devices?type=1': [],
        'GET /home/devices': [],
        'GET /home/devices?type=airToWater': [],
        'GET /language': 'fr',
      }),
    })

    expect(FakeChart.instances).toHaveLength(0)
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should clamp a legacy height up to the smallest offered one', async () => {
    await boot({ settings: { height: '200' } })

    expect(getDiv('chart').style.height).toBe('400px')
  })

  it('should apply the stored default zone and chart', async () => {
    await boot({
      settings: {
        chart: 'signal',
        default_zone: mock<ChartsWidgetSettings['default_zone']>({
          id: 12,
          model: 'devices',
        }),
      },
    })

    expect(getSelect('charts').value).toBe('signal')
    expect(getSelect('zones').value).toBe('devices_12')
  })

  it('should narrow the zone line-up per chart', async () => {
    await boot()
    commit(getSelect('charts'), 'hourly_temperatures')
    await settleDetached()

    // Hourly temperatures are ATW-only, on both sides.
    expect(optionValues(getSelect('zones'))).toStrictEqual([
      'homeDevices_h1',
      'devices_12',
    ])
  })

  it('should hide the day picker on an hourly chart', async () => {
    await boot()

    expect(getSelect('days').hidden).toBe(false)

    commit(getSelect('charts'), 'hourly_temperatures')
    await settleDetached()

    expect(getSelect('days').hidden).toBe(true)
  })

  it('should offer the rolling window except on a classic ATW report', async () => {
    await boot({ settings: { chart: 'report' } })
    commit(getSelect('zones'), 'devices_11')
    await settleDetached()

    expect(optionValues(getSelect('days')).at(0)).toBe('0')

    // The Classic ATW wire never buckets energy under a day.
    commit(getSelect('zones'), 'devices_12')
    await settleDetached()

    expect(optionValues(getSelect('days')).at(0)).not.toBe('0')
  })

  it('should open on the rolling window when it is the stored default', async () => {
    await boot({ settings: { days: 0 } })

    expect(getSelect('days').value).toBe('0')
  })

  it('should fall back to a real day count when the rolling window is gone', async () => {
    await boot({ settings: { chart: 'report', days: 0 } })
    commit(getSelect('zones'), 'devices_12')
    await settleDetached()

    // A default no option can express must not empty the picker: the
    // guarded write leaves the first real day count selected.
    expect(getSelect('days').value).toBe('1')
  })

  it('should keep the day choices within the published bounds', async () => {
    await boot({ settings: { days: 9999 } })

    expect(optionValues(getSelect('days'))).not.toContain('9999')

    const values = optionValues(getSelect('days'))
      .filter((value) => value !== '0')
      .map(Number)

    expect(values.every((days) => days > 0 && days <= 365)).toBe(true)
  })

  it('should fetch the selected chart, zone and day count', async () => {
    const harness = await boot({ settings: { chart: 'report', days: 30 } })
    commit(getSelect('zones'), 'devices_11')
    await settleDetached()
    const path = harness.api.mock.calls.findLast(([, called]) =>
      called.includes('/logs/'),
    )?.[1]

    expect(path).toBe('/classic/devices/11/logs/report?days=30')
  })

  it('should route a home device to its own endpoint', async () => {
    const harness = await boot()
    commit(getSelect('zones'), 'homeDevices_h1')
    await settleDetached()
    const path = harness.api.mock.calls.findLast(([, called]) =>
      called.includes('/logs/'),
    )?.[1]

    expect(path).toBe('/home/devices/h1/logs/temperatures?days=7')
  })

  it('should update the live chart in place on a refresh', async () => {
    await boot()
    const chart = lastChart()
    commit(getSelect('days'), '30')
    await settleDetached()

    expect(FakeChart.instances).toHaveLength(1)
    expect(chart.update).toHaveBeenCalledWith()
  })

  it('should recreate the chart when the type flips', async () => {
    await boot({ settings: { chart: 'operation_modes' } })
    const pie = lastChart()

    expect(pie.config.type).toBe('pie')

    commit(getSelect('charts'), 'temperatures')
    await settleDetached()

    expect(pie.destroy).toHaveBeenCalledWith()
    expect(FakeChart.instances).toHaveLength(2)
  })

  it('should carry a line legend toggle across refreshes', async () => {
    await boot()
    const chart = lastChart()
    chart.hiddenDatasets.add(0)
    commit(getSelect('days'), '30')
    await settleDetached()

    expect(chart.data.datasets[0]?.hidden).toBe(true)
  })

  it('should surface a failed refresh without stopping the loop', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const harness = await boot({
      failures: {
        'GET /home/devices/h1/logs/temperatures?days=7': new Error('logs down'),
      },
    })

    expect(vi.mocked(reportError)).toHaveBeenCalledWith(expect.any(Error))
    expect(harness.ready).toHaveBeenCalledTimes(1)

    // The rearmed timer retries on its own.
    const before = harness.api.mock.calls.length
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    await settleDetached()

    expect(harness.api.mock.calls.length).toBeGreaterThan(before)
  })

  it('should skip the boot when the page is stale', async () => {
    const stamp = document.createElement('script')
    stamp.setAttribute('src', 'index.js?v=aaaaaaaa')
    document.head.append(stamp)
    const harness = await boot({
      routes: withLogs({
        ...defaultRoutes(),
        'GET /webview-hashes': { charts: 'bbbbbbbb' },
      }),
    })

    expect(harness.ready).not.toHaveBeenCalled()
    expect(FakeChart.instances).toHaveLength(0)
  })

  it('should paint a mode band behind the series', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({ bands: [{ from: 0, label: 'Heating', to: 1 }] }),
      },
    })
    const chart = lastChart()
    runPlugin('modeBands', 'beforeDatasetsDraw', chart)

    expect(chart.ctx.fillRect).toHaveBeenCalledTimes(1)
    expect(chart.ctx.save).toHaveBeenCalledTimes(1)
    expect(chart.ctx.restore).toHaveBeenCalledTimes(1)
  })

  it('should skip a band whose ghost legend entry is hidden', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({ bands: [{ from: 0, label: 'Heating', to: 1 }] }),
      },
    })
    const chart = lastChart()
    const hiddenIndex = chart.data.datasets.findIndex(
      ({ label }) => label === 'Heating',
    )
    chart.hiddenDatasets.add(hiddenIndex)
    runPlugin('modeBands', 'beforeDatasetsDraw', chart)

    expect(chart.ctx.fillRect).not.toHaveBeenCalled()
  })

  it('should bound the signal axis to the dBm range', async () => {
    await boot({
      routes: { ...withLogs(), line: lineOptions({ unit: 'dBm' }) },
      settings: { chart: 'signal' },
    })
    const { scales } = mock<{
      scales: { yAxis: { max: number; min: number } }
    }>(lastChart().options)

    expect(scales.yAxis).toMatchObject({ max: 0, min: -100 })
  })

  // The palette is picked by position and cycles: a twelfth unnamed
  // series takes the colour of the first, which pins both the order of
  // the palette and the arithmetic reading it back.
  it('should cycle the palette over series the vocabulary does not name', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({
          series: Array.from({ length: 12 }, (_unusedValue, index) => ({
            data: [index],
            name: `Device ${String(index)}`,
          })),
        }),
      },
      settings: { chart: 'signal' },
    })
    const { datasets } = lastChart().data

    expect(datasets.map(({ borderColor }) => borderColor)).toStrictEqual([
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
      '#1F77B4',
    ])
  })

  it('should leave a bandless line chart unpainted', async () => {
    await boot()
    const chart = lastChart()
    runPlugin('modeBands', 'beforeDatasetsDraw', chart)

    expect(chart.ctx.fillRect).not.toHaveBeenCalled()
  })

  it('should skip a pie slice with no resolved centre', async () => {
    await boot({ settings: { chart: 'operation_modes' } })
    const chart = lastChart()
    const detached = new ChartArcElement(
      new Map([
        ['circumference', Math.PI],
        ['endAngle', Math.PI],
        ['outerRadius', 50],
        ['startAngle', 0],
        ['x', null],
        ['y', null],
      ]),
    )
    chart.meta.data = [detached]
    runPlugin('pieDataLabels', 'afterDatasetsDraw', chart)

    expect(chart.ctx.fillText).not.toHaveBeenCalled()
  })

  it('should carry hidden pie slices into a recreated chart', async () => {
    const harness = await boot({ settings: { chart: 'operation_modes' } })
    // Hide `Heating`, then shift the slice line-up so the chart must be
    // recreated: the toggle is index-keyed inside Chart.js and only
    // survives because it is re-applied by label.
    lastChart().hiddenPoints.add(0)
    harness.api.mockImplementation(async (method, path) => {
      await Promise.resolve()
      if (path.includes('/logs/operation-modes')) {
        return pieOptions({ labels: ['Heating', 'Cooling'], series: [3, 2] })
      }
      return defaultRoutes()[`${method} ${path}`]
    })
    commit(getSelect('days'), '30')
    await settleDetached()

    expect(lastChart().toggled).toStrictEqual([0])
  })

  it('should recreate a pie whose slice line-up shifted', async () => {
    const harness = await boot({ settings: { chart: 'operation_modes' } })
    const first = lastChart()
    harness.api.mockImplementation(async (method, path) => {
      await Promise.resolve()
      if (path.includes('/logs/operation-modes')) {
        return pieOptions({ labels: ['Heating'], series: [3] })
      }
      return defaultRoutes()[`${method} ${path}`]
    })
    commit(getSelect('days'), '30')
    await settleDetached()

    expect(first.destroy).toHaveBeenCalledWith()
    expect(FakeChart.instances).toHaveLength(2)
  })

  it('should keep the same pie in place when its slices match', async () => {
    await boot({ settings: { chart: 'operation_modes' } })
    const first = lastChart()
    commit(getSelect('days'), '30')
    await settleDetached()

    expect(first.destroy).not.toHaveBeenCalled()
    expect(first.update).toHaveBeenCalledWith()
  })

  it('should drop a response the picker already moved past', async () => {
    const logs = Promise.withResolvers<unknown>()
    const harness = await boot()
    const drawn = FakeChart.instances.length
    harness.api.mockImplementation(async (method, path) => {
      if (path.includes('/logs/')) {
        return logs.promise
      }
      return defaultRoutes()[`${method} ${path}`]
    })
    commit(getSelect('days'), '30')
    commit(getSelect('days'), '60')
    logs.resolve(lineOptions())
    await settleDetached()
    await settleDetached()

    // Both chains resolve, but the stale one renders nothing.
    expect(FakeChart.instances).toHaveLength(drawn)
  })

  it('should leave the bands unpainted before the scale exists', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({ bands: [{ from: 0, label: 'Heating', to: 1 }] }),
      },
    })
    const chart = lastChart()
    // A first paint can run before the category scale is laid out.
    chart.scales.xAxis = undefined
    runPlugin('modeBands', 'beforeDatasetsDraw', chart)

    expect(chart.ctx.fillRect).not.toHaveBeenCalled()
  })

  it('should exclude a hidden slice from the pie percentages', async () => {
    await boot({ settings: { chart: 'operation_modes' } })
    const chart = lastChart()
    // Hiding the 1-unit slice leaves 3 of 3 visible units.
    chart.hiddenPoints.add(1)
    const arc = new ChartArcElement(
      new Map([
        ['circumference', Math.PI],
        ['endAngle', Math.PI],
        ['outerRadius', 50],
        ['startAngle', 0],
        ['x', 100],
        ['y', 100],
      ]),
    )
    chart.meta.data = [arc]
    runPlugin('pieDataLabels', 'afterDatasetsDraw', chart)

    expect(chart.ctx.fillText).toHaveBeenCalledWith(
      '100.0%',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('should paint an unknown band in the neutral colour', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({ bands: [{ from: 0, label: 'Unknown', to: 1 }] }),
      },
    })
    const chart = lastChart()
    runPlugin('modeBands', 'beforeDatasetsDraw', chart)

    expect(chart.ctx.fillStyle).toBe('rgba(127, 127, 127, 0.2)')
  })

  it('should stack produced energy apart from consumed', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({
          series: [
            { data: [1], name: 'ProducedHeating' },
            { data: [2], name: 'ConsumedHeating' },
          ],
        }),
      },
      settings: { chart: 'report' },
    })
    const stacks = lastChart().data.datasets.map(({ stack }) => stack)

    expect(stacks).toStrictEqual(['produced', 'consumed'])
  })

  it('should localize a series name when a translation exists', async () => {
    const harness = createHarness()
    vi.spyOn(harness.homey, '__').mockImplementation(
      (key: object | string): string => {
        if (typeof key !== 'string') {
          return ''
        }
        return key === 'widgets.charts.series.RoomTemperature' ? 'Pièce' : key
      },
    )
    await start(harness.homey)
    await settleDetached()

    expect(lastChart().data.datasets[0]?.label).toBe('Pièce')
  })

  it('should offer no chart whose devices are all missing', async () => {
    await boot({
      routes: withLogs({
        ...defaultRoutes(),
        'GET /classic/devices?type=1': [],
        'GET /home/devices?type=airToWater': [],
      }),
    })

    // Hourly temperatures are ATW-only: with no ATW device anywhere the
    // chart is not offered at all.
    expect(optionValues(getSelect('charts'))).not.toContain(
      'hourly_temperatures',
    )
  })

  it('should poll an hourly chart every minute', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const harness = await boot({ settings: { chart: 'signal' } })
    const before = harness.api.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    await settleDetached()

    expect(harness.api.mock.calls.length).toBeGreaterThan(before)
  })

  it('should wait for the aggregation delay on a daily chart', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    // The clock is stubbed through `Temporal.Now`, never `Date`:
    // `temporal-polyfill` delegates to a runtime-provided `Temporal`,
    // where a faked `Date` would never be read.
    const at = (time: string): Temporal.ZonedDateTime =>
      Temporal.ZonedDateTime.from(`2026-08-10T${time}[UTC]`)
    const nowSpy = vi
      .spyOn(Temporal.Now, 'zonedDateTimeISO')
      .mockReturnValue(at('10:02'))
    const harness = await boot()
    const before = harness.api.mock.calls.length

    // 10:02 → this hour's hh:05 is still ahead: three minutes.
    await vi.advanceTimersByTimeAsync(3 * 60_000)
    await settleDetached()

    expect(harness.api.mock.calls.length).toBeGreaterThan(before)

    // 10:07 → the next one is an hour out.
    nowSpy.mockReturnValue(at('10:07'))
    const afterFirst = harness.api.mock.calls.length
    await vi.advanceTimersByTimeAsync(50 * 60_000)
    await settleDetached()

    expect(harness.api.mock.calls.length).toBeGreaterThan(afterFirst)
  })

  it('should format the axis ticks through the built config', async () => {
    await boot()
    const { scales } = mock<{
      scales: { yAxis: { ticks: { callback: (value: number) => string } } }
    }>(lastChart().options)

    // The renderer never runs under the fake, so the callback is
    // exercised where it lives: on the config the widget hands over.
    expect(scales.yAxis.ticks.callback(21)).toContain('21')
  })

  it('should label the wide pie slices only', async () => {
    await boot({ settings: { chart: 'operation_modes' } })
    const chart = lastChart()
    const wide = new ChartArcElement(
      new Map([
        ['circumference', Math.PI],
        ['endAngle', Math.PI],
        ['outerRadius', 50],
        ['startAngle', 0],
        ['x', 100],
        ['y', 100],
      ]),
    )
    const narrow = new ChartArcElement(
      new Map([
        ['circumference', 0.01],
        ['endAngle', 0.01],
        ['outerRadius', 50],
        ['startAngle', 0],
        ['x', 100],
        ['y', 100],
      ]),
    )
    chart.meta.data = [wide, narrow]
    runPlugin('pieDataLabels', 'afterDatasetsDraw', chart)

    expect(chart.ctx.fillText).toHaveBeenCalledTimes(1)
    expect(chart.ctx.fillText).toHaveBeenCalledWith(
      '75.0%',
      expect.any(Number),
      expect.any(Number),
    )
  })

  it('should draw no band for a chart the band map never saw', async () => {
    await boot({
      routes: {
        ...withLogs(),
        line: lineOptions({ bands: [{ from: 0, label: 'Heating', to: 1 }] }),
      },
    })
    const orphan = new FakeChart(
      document.createElement('canvas'),
      lastChart().config,
    )
    // Constructing it registered it as the latest; restore the real one so
    // the plugin is still looked up on the booted chart.
    FakeChart.instances.pop()
    runPlugin('modeBands', 'beforeDatasetsDraw', orphan)

    expect(orphan.ctx.fillRect).not.toHaveBeenCalled()
  })

  it.each(['bold', 'bolder', 'lighter', 'normal'])(
    'should read the %s font weight from the live tokens',
    async (weight) => {
      document.documentElement.style.setProperty(
        '--homey-font-weight-regular',
        weight,
      )
      await boot()

      expect(lastChart().config.options?.plugins?.title?.font).toMatchObject({
        weight,
      })
    },
  )

  it('should fall back to the default chart when the picker holds an unknown value', async () => {
    const harness = await boot()
    const charts = getSelect('charts')
    const unknown = document.createElement('option')
    unknown.value = 'not_a_chart'
    charts.append(unknown)
    harness.api.mockClear()
    commit(charts, 'not_a_chart')
    await settleDetached()

    expect(harness.api).toHaveBeenCalledWith(
      'GET',
      expect.stringContaining('/logs/operation-modes'),
    )
  })

  it('should resize when a load that outlived its timeout recovers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const harness = createHarness()
    // The language fetch is held open past the overlay's own timeout.
    const { promise: gate, resolve: release } = Promise.withResolvers<string>()
    harness.api.mockImplementationOnce(async () => gate)
    const booting = start(harness.homey)
    // The overlay gives up first: `runWebview` resolves on its own
    // timeout, so the boot is "ready" while the load is still in flight.
    await vi.advanceTimersByTimeAsync(10_000)
    harness.setHeight.mockClear()
    release('fr')
    await booting
    await settleDetached()

    expect(harness.setHeight).toHaveBeenCalledWith(expect.any(Number))
  })
})
