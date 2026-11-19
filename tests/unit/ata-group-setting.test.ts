// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import type { HomeBuildingZone, HomeDeviceZone } from '@olivierzal/melcloud-api'
import { getButton, getSelect } from '@olivierzal/homey-kit/dom'
import { mock, settleDetached } from '@olivierzal/homey-kit/testing'
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
  widgetRoutes,
} from '../ata-group-harness.ts'
import { stubRandomUint32 } from '../random.ts'

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

const zoneOptions = (): { label: string | null; value: string }[] =>
  [...getSelect('zones').options].map(({ textContent, value }) => ({
    label: textContent,
    value,
  }))

// Both accounts list a "Domicile"; only Classic lists an "Atelier", which
// sorts first, and only Home a "Villa".
const sameNameRoutes = (): Record<string, unknown> => ({
  ...widgetRoutes(),
  'GET /classic/buildings': [
    {
      areas: [],
      devices: [{ id: 21, level: 1, model: 'devices', name: 'Cuisine' }],
      floors: [],
      id: 2,
      level: 0,
      model: 'buildings',
      name: 'Atelier',
    },
    {
      areas: [],
      devices: [{ id: 11, level: 1, model: 'devices', name: 'Living room' }],
      floors: [],
      id: 1,
      level: 0,
      model: 'buildings',
      name: 'Domicile',
    },
  ],
  'GET /home/targets/ata': [
    {
      buildingName: 'Domicile',
      id: 'b_2',
      level: 0,
      model: 'homeBuildings',
      name: 'Domicile',
    },
    {
      buildingName: 'Domicile',
      deviceType: 'ata',
      id: 'ata_2',
      level: 1,
      model: 'homeDevices',
      name: 'Bureau',
    },
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
  ],
  'GET /targets/buildings_2/ata': groupStateFixture(),
  'GET /targets/mergedBuildings_1_b_2/ata': groupStateFixture(),
})

const updateError = (): HTMLElement => {
  const element = document.querySelector('#update_error')
  if (element instanceof HTMLElement) {
    return element
  }
  throw new TypeError('The page has no write-error line')
}

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

  it('should list the two accounts building by building', async () => {
    await bootWidget({
      routes: {
        ...widgetRoutes(),
        'GET /home/targets/ata': [
          {
            buildingName: 'Atelier',
            id: 'b_2',
            level: 0,
            model: 'homeBuildings',
            name: 'Atelier',
          },
          {
            buildingName: 'Atelier',
            deviceType: 'ata',
            id: 'ata_2',
            level: 1,
            model: 'homeDevices',
            name: 'Bureau',
          },
        ],
        'GET /targets/homeBuildings_b_2/ata': groupStateFixture(),
      },
    })

    expect(
      [...getSelect('zones').options].map(({ value }) => value),
    ).toStrictEqual([
      'homeBuildings_b_2',
      'homeDevices_ata_2',
      'buildings_1',
      'devices_11',
    ])
  })

  // The house the two buildings make is ONE entry in place of them: it
  // nests what the Classic building holds and leads the Home building's
  // units, its value the targetId the routes resolve.
  it('should list a house both accounts share as one entry', async () => {
    await bootWidget({ routes: sameNameRoutes() })

    expect(zoneOptions()).toStrictEqual([
      { label: ' Atelier', value: 'buildings_2' },
      { label: '··· Cuisine', value: 'devices_21' },
      { label: ' Domicile [Classic + Home]', value: 'mergedBuildings_1_b_2' },
      { label: '··· Living room', value: 'devices_11' },
      { label: '··· Bureau', value: 'homeDevices_ata_2' },
      { label: ' Villa', value: 'homeBuildings_b_1' },
      { label: '··· Salon', value: 'homeDevices_ata_1' },
    ])
    // A widget with no default zone opens on the first entry.
    expect(getSelect('zones').value).toBe('buildings_2')
  })

  // A default stored as one of the two buildings, before the house read
  // as one entry, opens on the house.
  it('should open a default stored as one of the two buildings on the house', async () => {
    await bootWidget({
      routes: sameNameRoutes(),
      settings: {
        default_zone: mock<HomeBuildingZone>({
          buildingName: 'Domicile',
          id: 'b_2',
          level: 0,
          model: 'homeBuildings',
          name: 'Domicile [Home]',
        }),
      },
    })

    expect(getSelect('zones').value).toBe('mergedBuildings_1_b_2')
  })

  // The merged value rides the same routes as any other: the app resolves
  // it, the widget never splits it.
  it('should read and write a merged house through its own value', async () => {
    const harness = await bootWidget({
      routes: {
        ...sameNameRoutes(),
        'PUT /targets/mergedBuildings_1_b_2/ata': undefined,
      },
      settings: {
        default_zone: {
          areas: [],
          buildingName: 'Domicile',
          devices: [],
          floors: [],
          id: '1_b_2',
          level: 0,
          model: 'mergedBuildings',
          name: 'Domicile [Classic + Home]',
        },
      },
    })
    commit(getSelect('SetTemperature'), '25')
    getButton('apply_values_melcloud').click()
    await settleDetached()

    expect(calledPaths(harness)).toContain(
      'GET /targets/mergedBuildings_1_b_2/ata',
    )
    expect(harness.api).toHaveBeenLastCalledWith(
      'PUT',
      '/targets/mergedBuildings_1_b_2/ata',
      { SetTemperature: 25 },
    )
  })

  it('should keep one selector source alive when the other fails', async () => {
    const harness = await bootWidget({
      failures: { 'GET /classic/buildings': new Error('classic down') },
      routes: {
        ...widgetRoutes(),
        'GET /targets/homeBuildings_b_1/ata': groupStateFixture(),
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
        'GET /classic/buildings': [],
        'GET /home/targets/ata': [],
      },
    })

    expect(document.querySelector('#values_melcloud select')).toBeNull()
    expect(calledPaths(harness)).not.toContain('GET /targets/buildings_1/ata')
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
        'GET /targets/devices_11/ata': {
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

  // A mixed answer would ask the zone now shown for its member modes:
  // a late answer from a zone the user left paints nothing at all.
  it('should paint nothing from a zone the user left', async () => {
    const get = Promise.withResolvers<unknown>()
    const harness = await bootWidget({
      deferredRoutes: {
        'GET /targets/devices_11/ata': async () => get.promise,
      },
    })
    commit(getSelect('zones'), 'devices_11')
    commit(getSelect('zones'), 'buildings_1')
    await settleDetached()
    get.resolve({
      ...groupStateFixture(),
      OperationMode: null,
      SetTemperature: 19,
    })
    await settleDetached()

    expect(getSelect('SetTemperature').value).not.toBe('19')
    expect(
      calledPaths(harness).filter((path) => path.endsWith('/modes')),
    ).toStrictEqual([])
  })

  it('should paint nothing from a real-time read of a zone the user left', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const get = Promise.withResolvers<unknown>()
    let reads = 0
    const harness = await bootWidget({
      deferredRoutes: {
        'GET /targets/buildings_1/ata': async () => {
          reads += 1
          return reads === 1 ? groupStateFixture() : get.promise
        },
      },
      routes: {
        ...widgetRoutes(),
        'GET /targets/devices_11/ata': groupStateFixture(),
      },
    })
    harness.emit('deviceupdate')
    await vi.advanceTimersByTimeAsync(1000)
    commit(getSelect('zones'), 'devices_11')
    await settleDetached()
    get.resolve({ ...groupStateFixture(), OperationMode: null })
    await settleDetached()

    expect(reads).toBe(2)
    expect(
      calledPaths(harness).filter((path) => path.endsWith('/modes')),
    ).toStrictEqual([])
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
    // No write error was showing, so the widget keeps its height.
    expect(harness.setHeight).not.toHaveBeenCalled()
  })

  // The widget SDK has no alert: a refused Update says why under the
  // buttons, the widget growing to show it and shrinking back once a
  // write lands.
  it('should show a refused write until a write lands', async () => {
    const put = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('Unit offline'))
      .mockResolvedValueOnce(undefined)
    const harness = await bootWidget({
      deferredRoutes: { 'PUT /targets/buildings_1/ata': put },
    })
    const apply = getButton('apply_values_melcloud')
    commit(getSelect('SetTemperature'), '25')
    apply.click()
    await settleDetached()

    expect(updateError().hidden).toBe(false)
    expect(updateError().textContent).toBe('Unit offline')
    expect(harness.setHeight).toHaveBeenCalledExactlyOnceWith(
      expect.any(Number),
    )
    // The edit stays armed for a retry.
    expect(apply.disabled).toBe(false)

    apply.click()
    await settleDetached()

    expect(updateError().hidden).toBe(true)
    expect(updateError().textContent).toBe('')
    expect(harness.setHeight).toHaveBeenCalledTimes(2)
    expect(apply.disabled).toBe(true)
  })

  // A write error belongs to its zone: the real-time refetch keeps it,
  // leaving the zone drops it.
  it('should keep a refused write shown until the zone is left', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const harness = await bootWidget({
      failures: { 'PUT /targets/buildings_1/ata': new Error('Unit offline') },
      routes: {
        ...widgetRoutes(),
        'GET /targets/devices_11/ata': groupStateFixture(),
      },
    })
    commit(getSelect('SetTemperature'), '25')
    getButton('apply_values_melcloud').click()
    await settleDetached()
    harness.emit('deviceupdate')
    await vi.advanceTimersByTimeAsync(1000)
    await settleDetached()

    expect(updateError().hidden).toBe(false)

    commit(getSelect('zones'), 'devices_11')
    await settleDetached()

    expect(updateError().hidden).toBe(true)
    expect(harness.setHeight).toHaveBeenCalledTimes(2)
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
        (key) => key === 'GET /targets/buildings_1/ata',
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
    routes['GET /targets/buildings_1/ata'] = {
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
    // `happy-dom` lays nothing out, so the measured height is zero.
    expect(harness.setHeight).toHaveBeenCalledWith(expect.any(Number))
  })
})
