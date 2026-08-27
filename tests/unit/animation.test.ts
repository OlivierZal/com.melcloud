// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import type * as Classic from '@olivierzal/melcloud-api/classic'
import { getDiv, getSelect } from '@olivierzal/homey-kit/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AnimationController } from '../../widgets/ata-group-setting/public/animation.mts'
import {
  type AnimationRecord,
  type WidgetHarnessOptions,
  animationsOf,
  createWidgetHomey,
  installAnimationApi,
  loadWidgetPage,
  setDocumentVisibility,
  stubRandomUint32,
  waitForSpawnTicks,
  waitUntil,
  widgetRoutes,
} from '../ata-group-harness.ts'
import { mock } from '../helpers.ts'

const HEAT = 1
const DRY = 2
const COOL = 3
const FAN = 7
const MIXED = 0

// Overrides are typed as loosely as the wire: a device may report a
// speed or mode outside the declared vocabulary, which is exactly what
// the degradation paths must survive.
const state = (
  overrides: Partial<Record<keyof Classic.GroupState, unknown>> = {},
): Classic.GroupState =>
  mock<Classic.GroupState>({
    FanSpeed: 3,
    OperationMode: HEAT,
    Power: true,
    SetTemperature: 22,
    ...overrides,
  })

interface ControllerHarness {
  readonly container: HTMLDivElement
  readonly controller: AnimationController
  readonly records: AnimationRecord[]
}

const createController = (
  options: WidgetHarnessOptions = {},
): ControllerHarness => {
  const records = installAnimationApi()
  const harness = createWidgetHomey(options)
  const container = getDiv('animation')
  const controller = new AnimationController(harness.homey, container)
  return { container, controller, records }
}

const addZone = (value: string): void => {
  const option = document.createElement('option')
  option.value = value
  getSelect('zones').append(option)
  getSelect('zones').value = value
}

const elementsIn = (
  container: HTMLDivElement,
  selector: string,
): HTMLElement[] => [...container.querySelectorAll<HTMLElement>(selector)]

const countIn = (container: HTMLDivElement, selector: string): number =>
  container.querySelectorAll(selector).length

describe('animation controller', () => {
  beforeEach(() => {
    loadWidgetPage()
    stubRandomUint32(0)
    vi.stubGlobal('reportError', vi.fn())
    setDocumentVisibility('visible')
  })

  afterEach(() => {
    // Stop every live spawn loop before the next test.
    setDocumentVisibility('hidden')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('should stay empty when everything is off', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state({ Power: false }))
    await waitForSpawnTicks()

    expect(container.childElementCount).toBe(0)
  })

  it('should stay empty when animations are opted out', async () => {
    const { container, controller } = createController({
      settings: { animations: false },
    })
    await controller.applyAnimation(state())
    await waitForSpawnTicks()

    expect(container.childElementCount).toBe(0)
  })

  it('should stay empty when the OS asks for reduced motion', async () => {
    const { container, controller } = createController()
    vi.stubGlobal('matchMedia', (): MediaQueryList =>
      mock<MediaQueryList>({ matches: true }),
    )
    await controller.applyAnimation(state())
    await waitForSpawnTicks()

    expect(container.childElementCount).toBe(0)
  })

  it('should spawn flickering flames and their smoke on heat', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state())
    await waitUntil(
      () =>
        countIn(container, '.flame') > 0 && countIn(container, '.smoke') > 0,
    )
    const [flame] = elementsIn(container, '.flame')

    expect(flame?.textContent).toBe('🔥')
    // Scale, rotate and brightness flickers compose per flame.
    expect(animationsOf(records, flame ?? container)).toHaveLength(3)
  })

  it('should space flames and wrap past the window edge', async () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: 30,
    })
    const { container, controller } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.flame') > 4)
    const positions = elementsIn(container, '.flame').map(
      ({ style }) => style.insetInlineStart,
    )

    // First flame lands at -gap*2 + gap; each next one gap further; past
    // the 30px window the position wraps back to -gap.
    expect(positions.slice(0, 5)).toStrictEqual([
      '-20px',
      '0px',
      '20px',
      '40px',
      '-20px',
    ])
  })

  it('should remove the flames when the scene leaves fire', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.flame') > 0)
    // A flame nobody ignited (no controller) is simply skipped.
    const rogue = document.createElement('div')
    rogue.classList.add('flame')
    container.append(rogue)
    await controller.applyAnimation(state({ OperationMode: COOL }))
    await waitUntil(
      () =>
        countIn(container, '.flame') === 1 &&
        countIn(container, '.snowflake') > 0,
    )

    expect(elementsIn(container, '.flame')).toStrictEqual([rogue])
  })

  it('should keep the flames across a heat-to-heat update', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.flame') > 0)
    const flames = elementsIn(container, '.flame')
    await controller.applyAnimation(state({ FanSpeed: 4 }))
    await waitForSpawnTicks()

    expect(flames.every((flame) => flame.isConnected)).toBe(true)
  })

  it('should drop a snowflake and remove it on arrival', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state({ OperationMode: COOL }))
    await waitUntil(() => countIn(container, '.snowflake') > 0)
    const [snowflake] = elementsIn(container, '.snowflake')
    const [fall] = animationsOf(records, snowflake ?? container)
    fall?.finish()

    expect(snowflake?.isConnected).toBe(false)
  })

  it('should loop a leaf and clear it when the drift ends', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state({ OperationMode: FAN }))
    await waitUntil(() => countIn(container, '.leaf') > 0)
    const [leaf] = elementsIn(container, '.leaf')

    expect(leaf?.style.offsetPath).toContain('path(')

    const leafAnimations = animationsOf(records, leaf ?? container)

    // Wobble plus drift; finishing the drift cancels both and removes.
    expect(leafAnimations).toHaveLength(2)

    leafAnimations.at(-1)?.finish()

    expect(leaf?.isConnected).toBe(false)
    expect(
      leafAnimations.some(({ cancel }) => cancel.mock.calls.length > 0),
    ).toBe(true)
  })

  it('should fly the sun in, spin it and reuse it', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state({ OperationMode: DRY }))
    const [sun] = elementsIn(container, '.sun')

    expect(sun?.textContent).toBe('☀')

    const [shine, motion] = animationsOf(records, sun ?? container)

    expect(shine?.playbackRate).toBe(3)

    // A finish while still inbound keeps the sun.
    motion?.finish()

    expect(sun?.isConnected).toBe(true)

    // Same scene again: the running animations are reused as-is.
    await controller.applyAnimation(state({ OperationMode: DRY }))

    expect(animationsOf(records, sun ?? container)).toHaveLength(2)
  })

  it('should reverse the sun out and rebuild it later', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state({ OperationMode: DRY }))
    const [sun] = elementsIn(container, '.sun')
    const [, motion] = animationsOf(records, sun ?? container)

    // Leaving the scene reverses the motion; a second sunless scene
    // leaves the outbound flight alone; returning reverses it back.
    await controller.applyAnimation(state({ OperationMode: HEAT }))

    expect(motion?.playbackRate).toBeLessThan(0)

    await controller.applyAnimation(state({ OperationMode: COOL }))

    expect(motion?.playbackRate).toBeLessThan(0)

    await controller.applyAnimation(state({ OperationMode: DRY }))

    expect(motion?.playbackRate).toBeGreaterThan(0)

    // Reversed out: the finish removes the sun and its animations.
    await controller.applyAnimation(state({ OperationMode: HEAT }))
    motion?.finish()

    expect(sun?.isConnected).toBe(false)

    // A later dry scene builds a fresh sun.
    await controller.applyAnimation(state({ OperationMode: DRY }))

    expect(elementsIn(container, '.sun')).toHaveLength(1)
  })

  it('should leave the sun untouched when it never flew', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state({ OperationMode: HEAT }))
    await controller.applyAnimation(state({ OperationMode: COOL }))

    expect(elementsIn(container, '.sun')).toHaveLength(0)
  })

  it('should merge the member scenes of a mixed classic zone', async () => {
    const { container, controller } = createController({
      routes: {
        ...widgetRoutes(),
        // The unknown vocabulary entry maps to no scene element.
        'GET /targets/devices_11/ata/modes': [HEAT, COOL, 99],
      },
    })
    addZone('devices_11')
    await controller.applyAnimation(state({ OperationMode: MIXED }))
    await waitUntil(
      () =>
        countIn(container, '.flame') > 0 &&
        countIn(container, '.snowflake') > 0,
    )

    expect(countIn(container, '.leaf')).toBe(0)
  })

  it('should read a mixed home building from its modes endpoint', async () => {
    const { container, controller } = createController({
      routes: {
        ...widgetRoutes(),
        'GET /targets/homeBuildings_b_1/ata/modes': [COOL],
      },
    })
    addZone('homeBuildings_b_1')
    // An absent mode reads as mixed.
    await controller.applyAnimation(state({ OperationMode: undefined }))
    await waitUntil(() => countIn(container, '.snowflake') > 0)

    expect(elementsIn(container, '.flame')).toHaveLength(0)
  })

  it('should keep the running scene when the mode fetch fails', async () => {
    const { container, controller } = createController({
      failures: {
        'GET /targets/devices_11/ata/modes': new Error('modes down'),
      },
    })
    addZone('devices_11')
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.flame') > 0)
    await controller.applyAnimation(state({ OperationMode: MIXED }))
    await waitForSpawnTicks()

    // The failure surfaced; the fire scene kept spawning.
    expect(vi.mocked(reportError).mock.calls.length).toBeGreaterThan(0)
    expect(countIn(container, '.flame')).toBeGreaterThan(0)
  })

  it('should let a newer apply win over a slower one', async () => {
    const modes = Promise.withResolvers<unknown>()
    const { container, controller } = createController({
      deferredRoutes: {
        'GET /targets/devices_11/ata/modes': async () => modes.promise,
      },
    })
    addZone('devices_11')
    const slower = controller.applyAnimation(state({ OperationMode: MIXED }))
    await controller.applyAnimation(state({ OperationMode: HEAT }))
    modes.resolve([COOL])
    await slower
    await waitForSpawnTicks()

    // The slower pass resolved into a superseded generation: no snow.
    expect(elementsIn(container, '.snowflake')).toHaveLength(0)
    expect(countIn(container, '.flame')).toBeGreaterThan(0)
  })

  it('should park while hidden and replay when shown', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.flame') > 0)
    setDocumentVisibility('hidden')
    // A state landing while hidden is remembered, not built.
    await controller.applyAnimation(state({ OperationMode: COOL }))
    await waitForSpawnTicks()

    expect(countIn(container, '.snowflake')).toBe(0)

    // Smoke chains survive the hide but stand down.
    const smokeBefore = countIn(container, '.smoke')
    await waitForSpawnTicks()

    expect(countIn(container, '.smoke')).toBe(smokeBefore)

    setDocumentVisibility('visible')
    await waitUntil(() => countIn(container, '.snowflake') > 0)

    // The replayed cool scene also swept the lingering flames.
    await waitUntil(() => countIn(container, '.flame') === 0)

    expect(countIn(container, '.flame')).toBe(0)
  })

  it('should do nothing on show before any state landed', async () => {
    const { container } = createController()
    setDocumentVisibility('hidden')
    setDocumentVisibility('visible')
    await waitForSpawnTicks()

    expect(container.childElementCount).toBe(0)
  })

  it('should keep the cadence alive on an underflowing speed', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state({ FanSpeed: -1_000_000 }))
    await waitUntil(() => countIn(container, '.flame') > 0)

    expect(countIn(container, '.flame')).toBeGreaterThan(0)
  })

  it('should treat a zero fan speed as moderate', async () => {
    const { container, controller } = createController()
    await controller.applyAnimation(state({ FanSpeed: 0 }))
    await waitUntil(() => countIn(container, '.flame') > 0)

    expect(countIn(container, '.flame')).toBeGreaterThan(0)
  })

  it('should cap the live smoke at the particle budget', async () => {
    Object.defineProperty(globalThis, 'innerWidth', {
      configurable: true,
      value: 30,
    })
    const { container, controller } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.smoke') === 500)
    await waitForSpawnTicks()

    expect(countIn(container, '.smoke')).toBe(500)
  })

  it('should surface a platform failure out of the spawn loop', async () => {
    const { controller } = createController()
    const broken = new Error('animate broken')
    vi.spyOn(document, 'createElement').mockImplementation(() =>
      mock<HTMLDivElement>({
        classList: mock<DOMTokenList>({
          add: vi.fn<(token: string) => void>(),
        }),
        style: mock<CSSStyleDeclaration>({
          setProperty: vi.fn<(property: string, value: string) => void>(),
        }),
        animate: (): Animation => {
          throw broken
        },
      }),
    )
    await controller.applyAnimation(state())
    await waitUntil(() =>
      vi.mocked(reportError).mock.calls.some(([error]) => error === broken),
    )

    expect(vi.mocked(reportError)).toHaveBeenCalledWith(broken)
  })

  it('should recycle a finished smoke particle', async () => {
    const { container, controller, records } = createController()
    await controller.applyAnimation(state())
    await waitUntil(() => countIn(container, '.smoke') > 0)
    const [particle] = elementsIn(container, '.smoke')
    animationsOf(records, particle ?? container)[0]?.finish()

    expect(particle?.isConnected).toBe(false)
  })

  it('should clamp a short-lived particle to one frame', async () => {
    const { container, controller } = createController()
    // A huge speed drives the viewport-exit term below one frame.
    await controller.applyAnimation(state({ FanSpeed: 20_000_000 }))
    await waitUntil(() => countIn(container, '.smoke') > 0)

    expect(countIn(container, '.smoke')).toBeGreaterThan(0)
  })
})
