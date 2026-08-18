// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import type { HomeDeviceZone } from '@olivierzal/melcloud-api'
import { getButton, getSelect } from '@olivierzal/homey-kit/dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { start } from '../../widgets/ata-group-setting/public/index.mts'
import {
  type WidgetHarness,
  type WidgetHarnessOptions,
  createWidgetHomey,
  groupStateFixture,
  installAnimationApi,
  loadWidgetPage,
  setDocumentVisibility,
  stubRandomUint32,
  widgetRoutes,
} from '../ata-group-harness.ts'
import { mock, settleDetached } from '../helpers.ts'

const bootWidget = async (
  options: WidgetHarnessOptions = {},
): Promise<WidgetHarness> => {
  const harness = createWidgetHomey(options)
  await start(harness.homey)
  await settleDetached()
  await settleDetached()
  return harness
}

const calledPaths = (harness: WidgetHarness): string[] =>
  harness.api.mock.calls.map(([method, path]) => `${method} ${path}`)

const commit = (
  element: HTMLElement & { value: string },
  value: string,
): void => {
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('ata group setting widget', () => {
  beforeEach(() => {
    sessionStorage.clear()
    loadWidgetPage()
    installAnimationApi()
    stubRandomUint32(0)
    vi.stubGlobal('reportError', vi.fn())
    setDocumentVisibility('visible')
  })

  afterEach(() => {
    setDocumentVisibility('hidden')
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('should boot, build the form and end the overlay once', async () => {
    const harness = await bootWidget()

    expect(document.documentElement.lang).toBe('fr')
    expect(getSelect('zones').ariaLabel).toBe('widgets.zones')
    expect(
      [...getSelect('zones').options].map(({ value }) => value),
    ).toStrictEqual([
      'buildings_1',
      'devices_11',
      'homeBuildings_b_1',
      'homeDevices_ata_1',
    ])
    expect(getSelect('SetTemperature').value).toBe('22')
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should skip the boot when the page is stale', async () => {
    const stamp = document.createElement('script')
    stamp.setAttribute('src', 'index.js?v=aaaaaaaa')
    document.head.append(stamp)
    const harness = await bootWidget({
      routes: {
        ...widgetRoutes(),
        'GET /webview-hashes': { 'ata-group-setting': 'bbbbbbbb' },
      },
    })

    expect(harness.ready).not.toHaveBeenCalled()
    expect(calledPaths(harness)).not.toContain('GET /classic/capabilities/ata')
  })

  it('should keep one selector source alive when the other fails', async () => {
    const harness = await bootWidget({
      failures: { 'GET /classic/buildings?type=0': new Error('classic down') },
      routes: {
        ...widgetRoutes(),
        'GET /home/buildings/b_1/ata': groupStateFixture(),
      },
    })

    expect(
      [...getSelect('zones').options].map(({ value }) => value),
    ).toStrictEqual(['homeBuildings_b_1', 'homeDevices_ata_1'])
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should build nothing without any target', async () => {
    const harness = await bootWidget({
      routes: {
        ...widgetRoutes(),
        'GET /classic/buildings?type=0': [],
        'GET /home/targets/ata': [],
      },
    })

    expect(document.querySelector('#values_melcloud select')).toBeNull()
    expect(calledPaths(harness)).not.toContain(
      'GET /classic/zones/buildings/1/ata',
    )
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should apply the stored default zone', async () => {
    await bootWidget({
      settings: {
        default_zone: mock<HomeDeviceZone>({ id: 11, model: 'devices' }),
      },
    })

    expect(getSelect('zones').value).toBe('devices_11')
  })

  it('should refetch and re-animate on a zone change', async () => {
    const harness = await bootWidget({
      routes: {
        ...widgetRoutes(),
        'GET /classic/zones/devices/11/ata': {
          ...groupStateFixture(),
          SetTemperature: 19,
        },
      },
    })
    commit(getSelect('zones'), 'devices_11')
    await settleDetached()

    expect(getSelect('SetTemperature').value).toBe('19')
    expect(harness.ready).toHaveBeenCalledTimes(1)
  })

  it('should update through the gate with haptic feedback', async () => {
    const harness = await bootWidget()
    const apply = getButton('apply_values_melcloud')

    expect(apply.disabled).toBe(true)

    commit(getSelect('SetTemperature'), '25')

    expect(apply.disabled).toBe(false)

    apply.click()
    await settleDetached()

    expect(harness.hapticFeedback).toHaveBeenCalledTimes(1)

    const put = harness.api.mock.calls.findLast(([method]) => method === 'PUT')

    expect(put?.[2]).toStrictEqual({ SetTemperature: 25 })
  })

  it('should refresh the form back to the known state', async () => {
    const harness = await bootWidget()
    commit(getSelect('SetTemperature'), '25')
    getButton('refresh_values_melcloud').click()

    expect(getSelect('SetTemperature').value).toBe('22')
    expect(getButton('apply_values_melcloud').disabled).toBe(true)
    expect(harness.hapticFeedback).toHaveBeenCalledTimes(1)
  })

  it('should debounce bursts of device updates into one refetch', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const harness = await bootWidget()
    const stateFetches = (): number =>
      calledPaths(harness).filter(
        (key) => key === 'GET /classic/zones/buildings/1/ata',
      ).length
    const before = stateFetches()
    harness.emit('deviceupdate')
    harness.emit('deviceupdate')
    await vi.advanceTimersByTimeAsync(1000)
    await settleDetached()

    expect(stateFetches()).toBe(before + 1)
  })

  it('should keep an in-progress edit across a device update', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const routes = widgetRoutes()
    const harness = await bootWidget({ routes })
    commit(getSelect('SetTemperature'), '25')
    routes['GET /classic/zones/buildings/1/ata'] = {
      ...groupStateFixture(),
      Power: false,
    }
    harness.emit('deviceupdate')
    await vi.advanceTimersByTimeAsync(1000)
    await settleDetached()

    expect(getSelect('Power').value).toBe('false')
    expect(getSelect('SetTemperature').value).toBe('25')
    expect(getButton('apply_values_melcloud').disabled).toBe(false)
  })

  it('should recover a load that outlives the overlay timeout', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const targets = Promise.withResolvers<unknown>()
    const harness = createWidgetHomey({
      deferredRoutes: { 'GET /home/targets/ata': async () => targets.promise },
    })
    const boot = start(harness.homey)
    await settleDetached()
    await vi.advanceTimersByTimeAsync(10_000)
    await boot

    // The overlay ended on the timeout, degraded but visible.
    expect(harness.ready).toHaveBeenCalledTimes(1)

    const initError = document.querySelector('#init_error')

    expect(initError?.textContent).not.toBe('')

    // The late success repaints over the degraded state and resizes.
    targets.resolve([])
    await settleDetached()
    await settleDetached()

    expect(initError?.textContent).toBe('')
    // happy-dom lays nothing out, so the measured height is zero.
    expect(harness.setHeight).toHaveBeenCalledWith(expect.any(Number))
  })
})
