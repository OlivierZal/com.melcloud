import { readFileSync } from 'node:fs'

import type * as Classic from '@olivierzal/melcloud-api/classic'
import { vi } from 'vitest'

import type { Homey } from '../public/widget.mts'
import type { DriverCapabilitiesOptions } from '../types/driver-settings.mts'
import type { AtaGroupSettingWidgetSettings } from '../types/widgets.mts'
import { mock } from './helpers.ts'

// A plain relative path: under the happy-dom environment
// `import.meta.url` is an http URL the fs module refuses.
const widgetHtml = readFileSync(
  'widgets/ata-group-setting/public/index.html',
  'utf8',
)

// DOMParser never executes scripts — the sanctioned way to load the real
// page into the simulated DOM.
export const loadWidgetPage = (): void => {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(widgetHtml, 'text/html')
  document.head.replaceChildren(...parsed.head.children)
  document.body.replaceChildren(...parsed.body.children)
}

// ── Web Animations API stand-in ──
// happy-dom ships no WAAPI: the fake records every `animate` call and
// lets a test drive `onfinish` by hand.

export interface AnimationRecord {
  readonly animation: FakeAnimation
  readonly element: HTMLElement
  readonly keyframes: Keyframe[] | PropertyIndexedKeyframes | null
  readonly options: number | KeyframeAnimationOptions | undefined
}

export class FakeAnimation {
  public readonly cancel: ReturnType<typeof vi.fn<() => void>> =
    vi.fn<() => void>()

  public onfinish: (() => void) | null = null

  public playbackRate = 1

  public finish(): void {
    this.onfinish?.()
  }

  public reverse(): void {
    this.playbackRate = -this.playbackRate
  }
}

// happy-dom ships no Web Animations API. Each freshly created element
// gets its own pair, closing over the element instead of reading `this`
// off a patched prototype — the animated elements all come from
// `createElement`, and a closure keeps the helpers plain arrows.
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml'

export const installAnimationApi = (): AnimationRecord[] => {
  const records: AnimationRecord[] = []
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
    // Built through the namespaced API: the spy owns `createElement`, and
    // reaching back for its original would hand a method around unbound.
    const element = document.createElementNS(HTML_NAMESPACE, tagName)
    if (!(element instanceof HTMLElement)) {
      throw new TypeError(`Cannot create <${tagName}>`)
    }
    Object.defineProperties(element, {
      animate: {
        value: (
          keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
          options?: number | KeyframeAnimationOptions,
        ): Animation => {
          const animation = new FakeAnimation()
          records.push({ animation, element, keyframes, options })
          return mock<Animation>(animation)
        },
      },
      getAnimations: {
        value: (): Animation[] =>
          records
            .filter((record) => record.element === element)
            .map(({ animation }) => mock<Animation>(animation)),
      },
    })
    return element
  })
  return records
}

export const animationsOf = (
  records: readonly AnimationRecord[],
  element: HTMLElement,
): FakeAnimation[] =>
  records
    .filter((record) => record.element === element)
    .map(({ animation }) => animation)

// Pins the CSPRNG so every generated delay and style value is exact:
// zero collapses all spawn delays, letting a scene tick per macrotask.
export const stubRandomUint32 = (value: number): void => {
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
    if (array instanceof Uint32Array) {
      array.fill(value)
    }
    return array
  })
}

// ── Fixtures ──

export const ataCapabilitiesFixture = (): [
  string,
  DriverCapabilitiesOptions,
][] => [
  ['Power', { title: 'Power', type: 'boolean' }],
  [
    'OperationMode',
    {
      title: 'Mode',
      type: 'enum',
      values: [
        { id: '1', label: 'Heat' },
        { id: '2', label: 'Dry' },
        { id: '3', label: 'Cool' },
        { id: '7', label: 'Fan' },
        { id: '8', label: 'Auto' },
      ],
    },
  ],
  ['SetTemperature', { title: 'Temperature', type: 'number' }],
  ['FanSpeed', { title: 'Fan speed', type: 'number' }],
  // A capability no control type maps to: the builder yields null and
  // the form skips it.
  ['SilentMode', { title: 'Silent', type: 'string' }],
]

export const groupStateFixture = (): Partial<Classic.GroupState> => ({
  FanSpeed: 3,
  OperationMode: 1,
  Power: true,
  SetTemperature: 22,
})

export const classicAtaBuildingsFixture = (): unknown => [
  {
    areas: [],
    devices: [{ id: 11, level: 1, model: 'devices', name: 'Living room' }],
    floors: [],
    id: 1,
    level: 0,
    model: 'buildings',
    name: 'Home',
  },
]

export const homeAtaTargetsFixture = (): unknown => [
  {
    buildingName: 'Villa',
    id: 'b_1',
    level: 0,
    model: 'homeBuildings',
    name: 'Villa',
  },
  {
    buildingName: 'Villa',
    deviceType: 'ata',
    id: 'ata_1',
    level: 1,
    model: 'homeDevices',
    name: 'Salon',
  },
]

export const widgetRoutes = (): Record<string, unknown> => ({
  'GET /classic/buildings?type=0': classicAtaBuildingsFixture(),
  'GET /classic/capabilities/ata': ataCapabilitiesFixture(),
  'GET /classic/zones/buildings/1/ata': groupStateFixture(),
  'GET /home/targets/ata': homeAtaTargetsFixture(),
  'GET /language': 'fr',
  'PUT /classic/zones/buildings/1/ata': undefined,
})

// ── Widget SDK mock ──

export interface WidgetHarness {
  readonly api: ReturnType<
    typeof vi.fn<
      (method: string, path: string, body?: object) => Promise<unknown>
    >
  >
  readonly hapticFeedback: ReturnType<typeof vi.fn>
  readonly homey: Homey<AtaGroupSettingWidgetSettings>
  readonly ready: ReturnType<typeof vi.fn>
  readonly setHeight: ReturnType<
    typeof vi.fn<(height: number) => Promise<void>>
  >
  readonly emit: (event: string) => void
}

export interface WidgetHarnessOptions {
  // Deferred routes: the test controls when (and with what) they settle.
  readonly deferredRoutes?: Readonly<Record<string, () => Promise<unknown>>>
  readonly failures?: Readonly<Record<string, Error>>
  readonly routes?: Record<string, unknown>
  readonly settings?: Partial<AtaGroupSettingWidgetSettings>
}

export const createWidgetHomey = (
  options: WidgetHarnessOptions = {},
): WidgetHarness => {
  const {
    deferredRoutes = {},
    failures = {},
    routes = widgetRoutes(),
    settings = {},
  } = options
  const listeners = new Map<string, (() => void)[]>()
  const api = vi
    .fn<(method: string, path: string, body?: object) => Promise<unknown>>()
    .mockImplementation(async (method, path) => {
      const key = `${method} ${path}`
      const failure = failures[key]
      if (failure !== undefined) {
        throw failure
      }
      const deferred = deferredRoutes[key]
      if (deferred !== undefined) {
        return deferred()
      }
      return routes[key]
    })
  const hapticFeedback = vi.fn<() => void>()
  const ready = vi.fn<() => void>()
  const setHeight = vi
    .fn<(height: number) => Promise<void>>()
    .mockResolvedValue(undefined)
  const homey = mock<Homey<AtaGroupSettingWidgetSettings>>({
    api,
    hapticFeedback,
    ready,
    setHeight,
    __: (key: string): string => key,
    getSettings: (): AtaGroupSettingWidgetSettings =>
      mock<AtaGroupSettingWidgetSettings>({
        animations: null,
        default_zone: null,
        ...settings,
      }),
    on: (event: string, listener: () => void): void => {
      const bucket = listeners.get(event) ?? []
      bucket.push(listener)
      listeners.set(event, bucket)
    },
  })
  return {
    api,
    hapticFeedback,
    homey,
    ready,
    setHeight,
    emit: (event: string): void => {
      const bucket = listeners.get(event)
      if (bucket === undefined) {
        return
      }
      for (const listener of bucket) {
        listener()
      }
    },
  }
}

export const setDocumentVisibility = (state: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

// Real-timer pause long enough for zero-delay spawn loops to tick a few
// times (each iteration crosses one macrotask).
export const waitForSpawnTicks = async (ms = 20): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

// Polls a plain predicate (no `expect` inside a retried callback, whose
// call count assertion counting could not pin down) until it holds.
export const waitUntil = async (predicate: () => boolean): Promise<void> => {
  await vi.waitFor(() => {
    if (!predicate()) {
      throw new Error('Condition not reached in time')
    }
  })
}
