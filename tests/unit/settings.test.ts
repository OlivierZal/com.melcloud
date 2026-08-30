// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import { readFileSync } from 'node:fs'

import type { DriverSetting } from '@olivierzal/homey-kit/manifest'
import type Homey from 'homey/lib/HomeySettings'
import {
  getButton,
  getDetails,
  getDiv,
  getFieldset,
  getInput,
  getSelect,
  getSpan,
} from '@olivierzal/homey-kit/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceSettings } from '../../types/device-settings.mts'
import { start } from '../../settings/index.mts'
import { mock, settleDetached } from '../helpers.ts'

// A plain relative path: under the happy-dom environment
// `import.meta.url` is an http URL the fs module refuses.
const pageHtml = readFileSync('settings/index.html', 'utf8')

type ApiCallArgs = readonly [
  method: string,
  path: string,
  ...rest: readonly (object | ApiCallback)[],
]

type ApiCallback = (error: Error | null, result: unknown) => void

interface Harness {
  readonly alert: ReturnType<typeof vi.fn<(message: string) => Promise<void>>>
  readonly api: ReturnType<typeof vi.fn<(...callArgs: ApiCallArgs) => void>>
  readonly homey: Homey
  readonly openURL: ReturnType<typeof vi.fn<(url: string) => Promise<void>>>
  readonly ready: ReturnType<typeof vi.fn>
  readonly emit: (event: string) => void
}

interface HarnessOptions {
  readonly failures?: Readonly<Record<string, Error>>
  readonly isConfirmed?: boolean
  readonly routes?: Record<string, unknown>
  readonly storedError?: Error | null
  readonly storedSettings?: Record<string, unknown>
  readonly translations?: Readonly<Record<string, string>>
}

const loginSettings = (): DriverSetting[] => [
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    groupId: 'login',
    id: 'username',
    placeholder: 'user@example.com',
    title: 'Email',
    type: 'text',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    groupId: 'login',
    id: 'password',
    title: 'Password',
    type: 'password',
  },
]

// The common section keeps dropdowns and checkboxes only (both rendered
// as selects), skips other types, and skips an id it already rendered.
const commonSettings = (): DriverSetting[] => [
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    id: 'always_on',
    title: 'Always on',
    type: 'checkbox',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    id: 'fan_mode',
    title: 'Fan mode',
    type: 'dropdown',
    values: [
      { id: 'slow', label: 'Slow' },
      { id: 'fast', label: 'Fast' },
    ],
  },
  {
    driverId: 'melcloud_atw',
    driverLabel: 'MELCloud ATW',
    id: 'always_on',
    title: 'Always on',
    type: 'checkbox',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    id: 'interval',
    title: 'Interval',
    type: 'number',
  },
]

const melcloudDriverSettings = (): DriverSetting[] => [
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    groupLabel: 'General',
    id: 'always_on',
    title: 'Always on',
    type: 'checkbox',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    groupLabel: 'General',
    id: 'power_sync',
    title: 'Power sync',
    type: 'checkbox',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    id: 'quiet',
    title: 'Quiet',
    type: 'checkbox',
  },
  {
    driverId: 'melcloud',
    driverLabel: 'MELCloud',
    id: 'fan_mode',
    title: 'Fan mode',
    type: 'dropdown',
  },
]

const driverSettingsFixture = (): Partial<Record<string, DriverSetting[]>> => ({
  login: loginSettings(),
  melcloud: melcloudDriverSettings(),
  // A driver with devices but no checkbox settings: no generated section.
  melcloud_atw: [
    {
      driverId: 'melcloud_atw',
      driverLabel: 'MELCloud ATW',
      id: 'fan_mode',
      title: 'Fan mode',
      type: 'dropdown',
    },
  ],
  options: commonSettings(),
})

const deviceSettingsFixture = (): DeviceSettings => ({
  melcloud: { always_on: true, fan_mode: 'slow', power_sync: false },
  melcloud_atw: { always_on: true, fan_mode: 'slow' },
})

const classicBuildingsFixture = (): unknown => [
  {
    areas: [],
    devices: [{ id: 11, level: 1, model: 'devices', name: 'Living room' }],
    floors: [
      {
        areas: [
          { devices: [], id: 31, level: 2, model: 'areas', name: 'Corner' },
        ],
        devices: [],
        id: 21,
        level: 1,
        model: 'floors',
        name: 'Upstairs',
      },
    ],
    id: 1,
    level: 0,
    model: 'buildings',
    name: 'Home',
  },
]

const homeTargetsFixture = (): unknown => [
  {
    buildingName: 'Villa',
    hasAta: true,
    hasAtw: true,
    id: 'building_1',
    level: 0,
    model: 'homeBuildings',
    name: 'Villa',
  },
  {
    buildingName: 'Villa',
    deviceType: 'ata',
    id: 'ata_device',
    level: 1,
    model: 'homeDevices',
    name: 'Salon',
  },
  {
    buildingName: 'Villa',
    deviceType: 'atw',
    id: 'atw_device',
    level: 1,
    model: 'homeDevices',
    name: 'Heat pump',
  },
]

const protectionFixture = (): unknown => ({ isEnabled: true, max: 12, min: 8 })

const holidayFixture = (): unknown => ({
  endDate: '2026-08-20T10:00',
  isEnabled: true,
  startDate: '2026-08-10T10:00',
})

const errorLogFixture = (
  count: number,
  nextFromDate = '2026-07-01',
): unknown => ({
  errors: Array.from({ length: count }, (_unusedValue, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, '0')}`,
    device: 'Living room',
    error: `Failure ${String(index)}`,
  })),
  fromDateHuman: '1 July 2026',
  nextFromDate,
  nextToDate: '2026-06-30',
})

const defaultRoutes = (): Record<string, unknown> => ({
  'DELETE /sessions/classic': undefined,
  'DELETE /sessions/home': undefined,
  'GET /classic/buildings': classicBuildingsFixture(),
  'GET /language': 'fr',
  'GET /sessions/classic': true,
  'GET /sessions/home': false,
  'GET /settings/devices': deviceSettingsFixture(),
  'GET /settings/drivers': driverSettingsFixture(),
  'GET /targets/buildings_1/settings/frost-protection': protectionFixture(),
  'GET /targets/buildings_1/settings/holiday-mode': holidayFixture(),
  'GET /webview-hashes': {},
  'POST /boot-error': undefined,
  'POST /sessions/classic': { isDeviceListStale: false },
  'POST /sessions/home': { isDeviceListStale: false },
  'PUT /settings/devices': undefined,
})

const apiImplementation =
  (
    failures: Readonly<Record<string, Error>>,
    routes: Record<string, unknown>,
  ): ((...callArgs: ApiCallArgs) => void) =>
  (...callArgs) => {
    const [method, path] = callArgs
    const callback = callArgs.findLast(
      (argument): argument is ApiCallback => typeof argument === 'function',
    )
    const key = `${method} ${path}`
    const failure = failures[key]
    if (failure === undefined) {
      callback?.(null, routes[key])
      return
    }
    callback?.(failure, null)
  }

const createApiMock = (
  failures: Readonly<Record<string, Error>>,
  routes: Record<string, unknown>,
): ReturnType<typeof vi.fn<(...callArgs: ApiCallArgs) => void>> =>
  vi.fn<(...callArgs: ApiCallArgs) => void>(apiImplementation(failures, routes))

// Replace the live routing after boot: the login flows re-probe routes
// the boot already answered differently.
const swapRoutes = (
  harness: Harness,
  routes: Record<string, unknown>,
  failures: Readonly<Record<string, Error>> = {},
): void => {
  harness.api.mockImplementation(apiImplementation(failures, routes))
}

const createHarness = (options: HarnessOptions = {}): Harness => {
  const {
    failures = {},
    isConfirmed = true,
    routes = {},
    storedError = null,
    storedSettings = {},
    translations = {},
  } = options
  const listeners = new Map<string, ((...args: unknown[]) => void)[]>()
  const api = createApiMock(failures, routes)
  const alert = vi
    .fn<(message: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  const openURL = vi
    .fn<(url: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  const ready = vi.fn<() => void>()
  const homey = mock<Homey>({
    alert,
    api,
    openURL,
    ready,
    __: (key: string, tokens?: Record<string, string>): string => {
      const text = translations[key] ?? key
      return tokens === undefined ? text : `${text} ${JSON.stringify(tokens)}`
    },
    confirm: (
      _message: string,
      _icon: string | null,
      callback: (error: Error | null, result: boolean) => void,
    ): void => {
      callback(null, isConfirmed)
    },
    get: (callback: (error: Error | null, settings: unknown) => void): void => {
      callback(storedError, storedSettings)
    },
    on: (event: string, listener: (...args: unknown[]) => void): void => {
      const bucket = listeners.get(event) ?? []
      bucket.push(listener)
      listeners.set(event, bucket)
    },
  })
  return {
    alert,
    api,
    homey,
    openURL,
    ready,
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

const bootPage = async (options: HarnessOptions = {}): Promise<Harness> => {
  const harness = createHarness({ routes: defaultRoutes(), ...options })
  await start(harness.homey)
  await settleDetached()
  await settleDetached()
  return harness
}

// A Home-only account: home signed in with paired Home devices, classic
// signed out — the shape every overheat-panel scenario starts from.
const bootHome = async (options: HarnessOptions = {}): Promise<Harness> =>
  bootPage({
    ...options,
    routes: {
      ...defaultRoutes(),
      'GET /home/targets': homeTargetsFixture(),
      'GET /sessions/classic': false,
      'GET /sessions/home': true,
      'GET /settings/devices': { 'home-melcloud': { always_on: true } },
      'GET /settings/drivers': {
        login: loginSettings(),
        options: commonSettings(),
      },
      ...options.routes,
    },
  })

// DOMParser never executes scripts, which is exactly why it is the
// sanctioned way to load the real page into the simulated DOM; appended
// nodes are auto-adopted across documents.
const loadPage = (): void => {
  const parser = new DOMParser()
  const parsed = parser.parseFromString(pageHtml, 'text/html')
  document.head.replaceChildren(...parsed.head.children)
  document.body.replaceChildren(...parsed.body.children)
}

interface HTMLValueElementLike extends HTMLElement {
  value: string
}

const commit = (element: HTMLValueElementLike, value: string): void => {
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

const commonSelect = (settingId: string): HTMLSelectElement => {
  const element = document.querySelector(
    `#settings_common select[data-setting-id="${CSS.escape(settingId)}"]`,
  )
  if (element instanceof HTMLSelectElement) {
    return element
  }
  throw new TypeError(`No generated select for setting \`${settingId}\``)
}

const driverCheckbox = (id: string): HTMLInputElement =>
  getInput(`${id}_melcloud`)

const lastCallBody = (harness: Harness, key: string): unknown => {
  const call = harness.api.mock.calls.findLast(
    ([method, path]) => `${method} ${path}` === key,
  )

  expect(call).toBeDefined()

  return call?.find((argument) => typeof argument === 'object')
}

const calledPaths = (harness: Harness): string[] =>
  harness.api.mock.calls.map(([method, path]) => `${method} ${path}`)

// Route the paged error-log fetches (their query strings vary by page)
// while every other route keeps its default answer.
const seeErrors = async (
  harness: Harness,
  count: number,
  nextFromDate?: string,
): Promise<void> => {
  const routes = defaultRoutes()
  harness.api.mockImplementation((...callArgs: ApiCallArgs) => {
    const [method, path] = callArgs
    const callback = callArgs.findLast(
      (argument): argument is ApiCallback => typeof argument === 'function',
    )
    if (path.startsWith('/logs/errors')) {
      callback?.(null, errorLogFixture(count, nextFromDate))
      return
    }
    callback?.(null, routes[`${method} ${path}`])
  })
  getButton('see').click()
  await settleDetached()
}

describe('settings page', () => {
  beforeEach(() => {
    sessionStorage.clear()
    loadPage()
    document.documentElement.lang = 'en'
  })

  describe('boot', () => {
    it('should boot, build the sections and call ready once', async () => {
      const harness = await bootPage()

      expect(harness.ready).toHaveBeenCalledTimes(1)
      expect(document.documentElement.lang).toBe('fr')
      expect(getDiv('content').hidden).toBe(false)
      // Credential fields generated from the login group.
      expect(getInput('username').placeholder).toBe('user@example.com')
      expect(getInput('password').type).toBe('password')
      // Common section: one select per dropdown/checkbox option, the
      // duplicate id and the number type skipped.
      expect(document.querySelectorAll('#settings_common select')).toHaveLength(
        2,
      )
      // Driver section: checkboxes from the melcloud driver only (the
      // ATW driver has no checkbox settings, home drivers no entry).
      expect(driverCheckbox('always_on').checked).toBe(true)
      expect(driverCheckbox('power_sync').checked).toBe(false)
      // The ATA extension link section shows for the classic ATA driver.
      expect(getDiv('auto_adjust_section').hidden).toBe(false)
      // Classic-only: the auth panel stays open on the signed-out Home.
      expect(getDetails('authentication').open).toBe(true)
    })

    it('should translate aria labels at start', async () => {
      await bootPage({ translations: { 'widgets.zones': 'Zones!' } })

      expect(getSelect('zones').ariaLabel).toBe('Zones!')
    })

    it('should populate the zone select from the classic tree', async () => {
      await bootPage()
      const options = [...getSelect('zones').options].map((option) => ({
        label: option.textContent,
        value: option.value,
      }))

      expect(options).toStrictEqual([
        { label: ' Home', value: 'buildings_1' },
        { label: '··· Living room', value: 'devices_11' },
        { label: '··· Upstairs', value: 'floors_21' },
        { label: '······ Corner', value: 'areas_31' },
      ])
    })

    it('should fill the zone panels from the fetched settings', async () => {
      await bootPage()

      expect(getSelect('enabled_frost_protection').value).toBe('true')
      expect(getInput('min').value).toBe('8')
      expect(getInput('max').value).toBe('12')
      expect(getSelect('enabled_holiday_mode').value).toBe('true')
      expect(getInput('start_date').value).toBe('2026-08-10T10:00')
      expect(getInput('end_date').value).toBe('2026-08-20T10:00')
    })

    it('should hide the content when no account is signed in', async () => {
      const harness = await bootPage({
        routes: { ...defaultRoutes(), 'GET /sessions/classic': false },
      })

      expect(getDiv('content').hidden).toBe(true)
      expect(getDetails('authentication').open).toBe(true)
      expect(harness.ready).toHaveBeenCalledTimes(1)
    })

    it('should keep a classic session with no paired device valid', async () => {
      await bootPage({
        routes: { ...defaultRoutes(), 'GET /classic/buildings': [] },
      })

      // NoClassicDeviceError is not an auth failure: content stays shown.
      expect(getDiv('content').hidden).toBe(false)
    })

    it('should drop the classic session when the building fetch fails', async () => {
      await bootPage({
        failures: { 'GET /classic/buildings': new Error('offline') },
      })

      expect(getDiv('content').hidden).toBe(true)
    })

    it('should load home targets when home has devices', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /home/targets': homeTargetsFixture(),
          'GET /sessions/classic': false,
          'GET /sessions/home': true,
          'GET /settings/devices': { 'home-melcloud': { always_on: true } },
        },
      })

      expect(getDiv('content').hidden).toBe(false)

      const values = [...getSelect('zones').options].map(({ value }) => value)

      expect(values).toStrictEqual([
        'homeBuildings_building_1',
        'homeDevices_ata_device',
        'homeDevices_atw_device',
      ])
      // The extension link also covers the Home ATA driver.
      expect(getDiv('auto_adjust_section').hidden).toBe(false)
    })

    it('should alert when a signed-in home account has no device', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /sessions/classic': false,
          'GET /sessions/home': true,
          'GET /settings/devices': {},
        },
      })

      // The initial validation skips targets; the alert path is the
      // post-login one, so booting stays silent here.
      expect(getDiv('content').hidden).toBe(false)
      expect(harness.ready).toHaveBeenCalledTimes(1)
    })

    it('should fall back to empty stored settings on a get error', async () => {
      const harness = await bootPage({ storedError: new Error('storage down') })

      expect(harness.alert).toHaveBeenCalledWith('storage down')
      expect(getInput('username').value).toBe('')
    })

    it('should keep the page language when the fetch fails', async () => {
      await bootPage({ failures: { 'GET /language': new Error('nope') } })

      expect(document.documentElement.lang).toBe('en')
    })

    it('should alert after ready when the boot load fails', async () => {
      const harness = await bootPage({
        failures: { 'GET /sessions/classic': new Error('boot down') },
      })

      expect(harness.ready).toHaveBeenCalledTimes(1)
      expect(harness.alert).toHaveBeenCalledWith('boot down')
    })

    it('should skip the boot when the page is stale', async () => {
      const stamp = document.createElement('script')
      stamp.setAttribute('src', 'index.js?v=aaaaaaaa')
      document.head.append(stamp)
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /webview-hashes': { settings: 'bbbbbbbb' },
        },
      })

      // The document is about to be replaced: no section is built.
      expect(document.querySelector('#username')).toBeNull()
      expect(harness.ready).not.toHaveBeenCalled()
    })

    it('should open the extension store page from the link button', async () => {
      const harness = await bootPage()
      getButton('auto_adjust').click()
      await settleDetached()

      expect(harness.openURL).toHaveBeenCalledWith(
        'https://homey.app/a/com.mecloud.extension',
      )
    })
  })

  describe('device settings', () => {
    it('should apply a common change to every driver', async () => {
      const harness = await bootPage()
      commit(commonSelect('fan_mode'), 'fast')
      const apply = getButton('apply_settings_common')

      expect(apply.disabled).toBe(false)

      apply.click()
      await settleDetached()

      expect(lastCallBody(harness, 'PUT /settings/devices')).toStrictEqual({
        fan_mode: 'fast',
      })
      expect(harness.alert).toHaveBeenCalledWith('settings.success')
      // The cache took the write: re-selecting the same value nets no
      // change, and Apply dropped back to disabled.
      expect(apply.disabled).toBe(true)
    })

    it('should convert boolean selects on write', async () => {
      const harness = await bootPage()
      commit(commonSelect('always_on'), 'false')
      getButton('apply_settings_common').click()
      await settleDetached()

      expect(lastCallBody(harness, 'PUT /settings/devices')).toStrictEqual({
        always_on: false,
      })
    })

    it('should alert nothing-to-update when a dirty edit nets none', async () => {
      const harness = await bootPage()
      // Blank means "no instruction": dirty against the snapshot, empty
      // in the body.
      commit(commonSelect('fan_mode'), '')
      const apply = getButton('apply_settings_common')

      expect(apply.disabled).toBe(false)

      apply.click()
      await settleDetached()

      expect(calledPaths(harness)).not.toContain('PUT /settings/devices')
      expect(harness.alert).toHaveBeenCalledWith('settings.devices.nothing')
      // The sync restored the cached value and re-baselined the gate.
      expect(commonSelect('fan_mode').value).toBe('slow')
      expect(apply.disabled).toBe(true)
    })

    it('should alert nothing-to-update on a driver edit netting none', async () => {
      const harness = await bootPage()
      // Re-marking a resolved checkbox mixed arms the gate (the snapshot
      // carries the flag) while the read yields "no instruction".
      const checkbox = driverCheckbox('always_on')
      checkbox.indeterminate = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      const apply = getButton('apply_settings_melcloud')

      expect(apply.disabled).toBe(false)

      apply.click()
      await settleDetached()

      expect(calledPaths(harness)).not.toContain(
        'PUT /settings/devices?driverId=melcloud',
      )
      expect(harness.alert).toHaveBeenCalledWith('settings.devices.nothing')
      expect(apply.disabled).toBe(true)
    })

    it('should treat a null driver entry as no baseline', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/devices': { melcloud: null },
        },
      })

      // No values to fold: the common selects render blank and the driver
      // checkboxes mixed.
      expect(commonSelect('always_on').value).toBe('')

      const checkbox = driverCheckbox('power_sync')

      expect(checkbox.indeterminate).toBe(true)

      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      getButton('apply_settings_melcloud').click()
      await settleDetached()

      expect(
        lastCallBody(harness, 'PUT /settings/devices?driverId=melcloud'),
      ).toStrictEqual({ power_sync: true })
    })

    it('should skip a foreign select on refresh and apply', async () => {
      // A select the page did not generate (no setting id) lands in the
      // section's registered controls but never in a body or a sync.
      const rogue = document.createElement('select')
      getDiv('settings_common').append(rogue)
      const harness = await bootPage()
      getButton('refresh_settings_common').click()
      commit(commonSelect('fan_mode'), 'fast')
      getButton('apply_settings_common').click()
      await settleDetached()

      expect(lastCallBody(harness, 'PUT /settings/devices')).toStrictEqual({
        fan_mode: 'fast',
      })
    })

    it('should refresh the common section from the cache', async () => {
      await bootPage()
      const select = commonSelect('fan_mode')
      commit(select, 'fast')
      const apply = getButton('apply_settings_common')

      expect(apply.disabled).toBe(false)

      getButton('refresh_settings_common').click()

      expect(select.value).toBe('slow')
      expect(apply.disabled).toBe(true)
    })

    it('should build no common control without an options group', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/drivers': { login: loginSettings() },
        },
      })

      expect(document.querySelector('#settings_common select')).toBeNull()
    })

    it('should show a blank select when drivers disagree', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/devices': {
            melcloud: { always_on: true },
            melcloud_atw: { always_on: false },
          },
        },
      })

      expect(commonSelect('always_on').value).toBe('')
    })

    it('should apply a driver checkbox change to that driver only', async () => {
      const harness = await bootPage()
      const checkbox = driverCheckbox('power_sync')
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      const apply = getButton('apply_settings_melcloud')

      expect(apply.disabled).toBe(false)

      apply.click()
      await settleDetached()

      expect(
        lastCallBody(harness, 'PUT /settings/devices?driverId=melcloud'),
      ).toStrictEqual({ power_sync: true })
      expect(harness.alert).toHaveBeenCalledWith('settings.success')
    })

    it('should render a mixed driver setting indeterminate', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/devices': { melcloud: { always_on: true } },
        },
      })
      const checkbox = driverCheckbox('power_sync')

      expect(checkbox.indeterminate).toBe(true)

      // The first change resolves the mixed state.
      checkbox.checked = true
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))

      expect(checkbox.indeterminate).toBe(false)
    })

    it('should refresh a driver section from the cache', async () => {
      await bootPage()
      const checkbox = driverCheckbox('always_on')
      checkbox.checked = false
      checkbox.dispatchEvent(new Event('change', { bubbles: true }))
      getButton('refresh_settings_melcloud').click()

      expect(checkbox.checked).toBe(true)
      expect(getButton('apply_settings_melcloud').disabled).toBe(true)
    })

    it('should alert and keep the form when the write fails', async () => {
      const harness = await bootPage({
        failures: { 'PUT /settings/devices': new Error('write down') },
      })
      commit(commonSelect('fan_mode'), 'fast')
      getButton('apply_settings_common').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('write down')
      expect(getButton('apply_settings_common').disabled).toBe(false)
    })

    it('should alert when the device settings fetch fails', async () => {
      const harness = await bootPage({
        failures: { 'GET /settings/devices': new Error('devices down') },
      })

      expect(harness.alert).toHaveBeenCalledWith('devices down')
    })

    it('should alert and build nothing when the driver fetch fails', async () => {
      const harness = await bootPage({
        failures: { 'GET /settings/drivers': new Error('drivers down') },
      })

      expect(harness.alert).toHaveBeenCalledWith('drivers down')
      expect(document.querySelectorAll('#settings_common select')).toHaveLength(
        0,
      )
    })
  })

  describe('credentials', () => {
    it('should sign in and reveal the account content', async () => {
      const harness = await bootPage({
        routes: { ...defaultRoutes(), 'GET /sessions/classic': false },
      })

      expect(getDiv('content').hidden).toBe(true)

      commit(getInput('username'), 'user@example.com')
      commit(getInput('password'), 'secret')
      const authenticate = getButton('authenticate')

      expect(authenticate.disabled).toBe(false)

      harness.api.mockClear()
      swapRoutes(harness, defaultRoutes())
      authenticate.click()
      await settleDetached()
      await settleDetached()

      expect(lastCallBody(harness, 'POST /sessions/classic')).toStrictEqual({
        password: 'secret',
        username: 'user@example.com',
      })
      expect(getDiv('content').hidden).toBe(false)
    })

    it('should trim the username before submitting', async () => {
      const harness = await bootPage()
      commit(getSelect('api'), 'classic')
      commit(getInput('username'), 'user@example.com ')
      commit(getInput('password'), 'secret')
      getButton('authenticate').click()
      await settleDetached()

      expect(lastCallBody(harness, 'POST /sessions/classic')).toStrictEqual({
        password: 'secret',
        username: 'user@example.com',
      })
    })

    it('should alert instead of submitting an emptied form', async () => {
      const harness = await bootPage()
      commit(getInput('username'), '')
      commit(getInput('password'), '')
      // Keyboard activation of a stale reference: dispatch on the
      // disabled button directly.
      getButton('authenticate').dispatchEvent(new Event('click'))
      await settleDetached()

      expect(calledPaths(harness)).not.toContain('POST /sessions/classic')
      expect(harness.alert).toHaveBeenCalledWith(
        'settings.authenticate.failure',
      )
    })

    it('should alert the classified reason when the login fails', async () => {
      const harness = await bootPage({
        failures: { 'POST /sessions/classic': new Error('Wrong credentials') },
      })
      commit(getSelect('api'), 'classic')
      commit(getInput('username'), 'user@example.com')
      commit(getInput('password'), 'wrong')
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('Wrong credentials')
    })

    it('should alert unverified when the session probe denies', async () => {
      const routes: Record<string, unknown> = {
        ...defaultRoutes(),
        'GET /sessions/classic': false,
      }
      const harness = await bootPage({ routes })
      commit(getInput('username'), 'user@example.com')
      commit(getInput('password'), 'secret')
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.authenticate.unverified',
      )
    })

    it('should treat a failed session probe as signed out', async () => {
      const harness = await bootPage()
      // The probe only fails after boot: the login path reads it fresh.
      swapRoutes(harness, defaultRoutes(), {
        'GET /sessions/home': new Error('probe down'),
      })
      commit(getSelect('api'), 'home')
      commit(getInput('username'), 'user@example.com')
      commit(getInput('password'), 'secret')
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.authenticate.unverified',
      )
    })

    it('should load the home targets after a home sign-in', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/devices': {
            ...deviceSettingsFixture(),
            'home-melcloud': { always_on: true },
          },
        },
      })
      // The picker already sits on home (the account needing attention).
      commit(getInput('username'), 'home@example.com')
      commit(getInput('password'), 'secret')
      swapRoutes(harness, {
        ...defaultRoutes(),
        'GET /home/targets': homeTargetsFixture(),
        'GET /sessions/home': true,
      })
      getButton('authenticate').click()
      await settleDetached()
      await settleDetached()
      const values = [...getSelect('zones').options].map(({ value }) => value)

      expect(values).toContain('homeDevices_ata_device')
    })

    it('should alert after a home sign-in with no home device', async () => {
      const harness = await bootPage()
      commit(getSelect('api'), 'home')
      commit(getInput('username'), 'home@example.com')
      commit(getInput('password'), 'secret')
      swapRoutes(harness, { ...defaultRoutes(), 'GET /sessions/home': true })
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('settings.devices.none')
    })

    it('should alert verbatim when the target load fails', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/devices': { 'home-melcloud': { always_on: true } },
        },
      })
      commit(getInput('username'), 'home@example.com')
      commit(getInput('password'), 'secret')
      swapRoutes(
        harness,
        { ...defaultRoutes(), 'GET /sessions/home': true },
        { 'GET /home/targets': new Error('targets down') },
      )
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('targets down')
    })

    // The route answers a stale device list on a sign-in the server
    // accepted but whose registry refresh failed. That is a warning
    // over a live session, never a credential failure: the page must
    // keep the account, open its content and say what actually broke.
    it('should reveal the account content when the device list came back stale', async () => {
      const harness = await bootPage({
        routes: { ...defaultRoutes(), 'GET /sessions/classic': false },
      })
      commit(getInput('username'), 'user@example.com')
      commit(getInput('password'), 'secret')
      swapRoutes(harness, {
        ...defaultRoutes(),
        'POST /sessions/classic': { isDeviceListStale: true },
      })
      getButton('authenticate').click()
      await settleDetached()
      await settleDetached()

      expect(getDiv('content').hidden).toBe(false)
      expect(harness.alert).toHaveBeenCalledWith(
        'settings.authenticate.staleDevices',
      )
      expect(harness.alert).not.toHaveBeenCalledWith(
        'settings.authenticate.rejected',
      )
    })

    // A refresh that failed is WHY the list came back empty, so it is
    // the message the user gets — "add a device" would send them after
    // a device they already own.
    it('should let the stale warning outrank the device check complaint', async () => {
      const harness = await bootPage()
      commit(getSelect('api'), 'home')
      commit(getInput('username'), 'home@example.com')
      commit(getInput('password'), 'secret')
      swapRoutes(harness, {
        ...defaultRoutes(),
        'GET /sessions/home': true,
        'POST /sessions/home': { isDeviceListStale: true },
      })
      getButton('authenticate').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.authenticate.staleDevices',
      )
      expect(harness.alert).not.toHaveBeenCalledWith('settings.devices.none')
    })

    it('should swap the fields when switching accounts', async () => {
      await bootPage({
        storedSettings: {
          homePassword: 'home-secret',
          homeUsername: 'home@example.com',
          password: 'classic-secret',
          username: 'classic@example.com',
        },
      })
      // Home holds no device here, so it never grabs the form: select it
      // and switch back, checking each account keeps its own pair.
      const api = getSelect('api')
      commit(api, 'home')

      expect(getInput('username').value).toBe('home@example.com')

      commit(api, 'classic')

      expect(getInput('username').value).toBe('classic@example.com')
      expect(getInput('password').value).toBe('classic-secret')
    })

    it('should collapse the auth panel when both accounts settle', async () => {
      await bootPage({
        routes: { ...defaultRoutes(), 'GET /sessions/home': true },
        storedSettings: {
          homePassword: 'home-secret',
          homeUsername: 'home@example.com',
          password: 'classic-secret',
          username: 'classic@example.com',
        },
      })

      expect(getDetails('authentication').open).toBe(false)
    })

    it('should open the picker on an incomplete stored account', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /home/targets': homeTargetsFixture(),
          'GET /sessions/home': true,
          'GET /settings/devices': {
            ...deviceSettingsFixture(),
            'home-melcloud': { always_on: true },
          },
        },
        storedSettings: {
          homeUsername: 'home@example.com',
          password: 'classic-secret',
          username: 'classic@example.com',
        },
      })

      // Both signed in and both in use, but home lost its password:
      // attention there.
      expect(getSelect('api').value).toBe('home')
      expect(getDetails('authentication').open).toBe(true)
    })

    it('should leave an unused account alone', async () => {
      // Classic signed in and in use, home signed out with nothing
      // paired to it: the panel has no chore to show, and the form must
      // not open on an account the user never adopted.
      await bootPage({
        routes: { ...defaultRoutes(), 'GET /sessions/home': false },
        storedSettings: {
          password: 'classic-secret',
          username: 'classic@example.com',
        },
      })

      expect(getSelect('api').value).toBe('classic')
      expect(getDetails('authentication').open).toBe(false)
    })

    it('should open on a signed-out account that has devices', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /sessions/home': false,
          'GET /settings/devices': {
            ...deviceSettingsFixture(),
            'home-melcloud': { always_on: true },
          },
        },
        storedSettings: {
          homePassword: 'home-secret',
          homeUsername: 'home@example.com',
          password: 'classic-secret',
          username: 'classic@example.com',
        },
      })

      expect(getSelect('api').value).toBe('home')
      expect(getDetails('authentication').open).toBe(true)
    })

    it('should reset the selected account after confirmation', async () => {
      const harness = await bootPage({
        storedSettings: { password: 'secret', username: 'user@example.com' },
      })
      commit(getSelect('api'), 'classic')

      expect(getInput('username').value).toBe('user@example.com')

      getButton('reset_credentials').click()
      await settleDetached()

      expect(calledPaths(harness)).toContain('DELETE /sessions/classic')
      expect(getInput('username').value).toBe('')
      expect(getInput('password').value).toBe('')
      // Logged out: the content follows the remaining account (none).
      expect(getDiv('content').hidden).toBe(true)
      expect(getDetails('authentication').open).toBe(true)
    })

    it('should do nothing when the reset is declined', async () => {
      const harness = await bootPage({
        isConfirmed: false,
        storedSettings: { password: 'secret', username: 'user@example.com' },
      })
      commit(getSelect('api'), 'classic')
      getButton('reset_credentials').click()
      await settleDetached()

      expect(calledPaths(harness)).not.toContain('DELETE /sessions/classic')
      expect(getInput('username').value).toBe('user@example.com')
    })

    it('should alert when the reset fails', async () => {
      const harness = await bootPage({
        failures: { 'DELETE /sessions/classic': new Error('reset down') },
        storedSettings: { password: 'secret', username: 'user@example.com' },
      })
      commit(getSelect('api'), 'classic')
      getButton('reset_credentials').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('reset down')
      expect(getInput('username').value).toBe('user@example.com')
    })

    it('should build no credential field without a login group', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /settings/drivers': { options: commonSettings() },
        },
      })

      expect(document.querySelector('#username')).toBeNull()
      // The arming predicate reads empty strings from the null inputs.
      expect(getButton('authenticate').disabled).toBe(true)
    })
  })

  describe('error log', () => {
    it('should render the fetched errors and the singular count', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 1)

      expect(getSpan('error_count').textContent).toBe(
        '1 settings.errorLog.errorCount.1',
      )

      const cells = [...document.querySelectorAll('#error_log td')].map(
        ({ textContent }) => textContent,
      )

      expect(cells).toStrictEqual(['2026-07-01', 'Living room', 'Failure 0'])
      expect(getInput('since').value).toBe('2026-07-01')
    })

    it('should use the paucal form for slavic counts', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 3)

      expect(getSpan('error_count').textContent).toBe(
        '3 settings.errorLog.errorCount.234',
      )
    })

    it('should use the plural form for teen counts', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 3)
      // 3 + 10 = 13: a teen, plural despite its 3 ending.
      await seeErrors(harness, 10)

      expect(getSpan('error_count').textContent).toBe(
        '13 settings.errorLog.errorCount.plural',
      )
      // The second batch reused the same table body.
      expect(document.querySelectorAll('#error_log table')).toHaveLength(1)
      expect(document.querySelectorAll('#error_log tbody tr')).toHaveLength(13)
    })

    it('should use the zero form on an empty log', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 0)

      expect(getSpan('error_count').textContent).toBe(
        '0 settings.errorLog.errorCount.0',
      )
      expect(document.querySelector('#error_log table')).toBeNull()
    })

    it('should clamp a since date beyond the window', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 1)
      // nextToDate landed as the upper bound: exceed it.
      commit(getInput('since'), '2026-07-15')

      expect(getInput('since').value).toBe('2026-06-30')
      expect(harness.alert).toHaveBeenCalledWith(
        'settings.errorLog.error {"from":"1 July 2026"}',
      )
    })

    it('should keep a since date inside the window', async () => {
      const harness = await bootPage()
      await seeErrors(harness, 1)
      commit(getInput('since'), '2026-06-01')

      expect(getInput('since').value).toBe('2026-06-01')
      expect(harness.alert).not.toHaveBeenCalledWith(
        'settings.errorLog.error {"from":"1 July 2026"}',
      )
    })

    it('should alert and re-enable the button when the fetch fails', async () => {
      const harness = await bootPage({
        failures: {
          'GET /logs/errors?from=&offset=0&period=29&to=': new Error(
            'log down',
          ),
        },
      })
      getButton('see').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('log down')
      expect(getButton('see').disabled).toBe(false)
    })
  })

  describe('zone panels', () => {
    it('should refetch the panels when the zone changes', async () => {
      const harness = await bootPage()
      harness.api.mockClear()
      commit(getSelect('zones'), 'devices_11')
      await settleDetached()

      expect(calledPaths(harness)).toStrictEqual([
        'GET /targets/devices_11/settings/frost-protection',
        'GET /targets/devices_11/settings/holiday-mode',
      ])
    })

    it('should fall back to defaults when the panel fetch fails', async () => {
      await bootPage({
        failures: {
          'GET /targets/buildings_1/settings/frost-protection': new Error(
            'panel down',
          ),
        },
      })

      expect(getSelect('enabled_frost_protection').value).toBe('false')
      expect(getInput('min').value).toBe('')
    })

    it('should keep the form on a refresh of an uncached panel', async () => {
      await bootPage({
        failures: {
          'GET /targets/buildings_1/settings/frost-protection': new Error(
            'panel down',
          ),
          'GET /targets/buildings_1/settings/holiday-mode': new Error(
            'panel down',
          ),
        },
      })
      // Nothing cached for the zone: a refresh only re-baselines.
      commit(getInput('min'), '5')
      getButton('refresh_frost_protection').click()

      expect(getInput('min').value).toBe('5')
      expect(getButton('apply_frost_protection').disabled).toBe(true)

      commit(getInput('start_date'), '2026-09-01T08:00')
      getButton('refresh_holiday_mode').click()

      expect(getInput('start_date').value).toBe('2026-09-01T08:00')
      expect(getButton('apply_holiday_mode').disabled).toBe(true)
    })

    it('should render a mixed panel blank', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/frost-protection': {
            isEnabled: null,
            max: null,
            min: null,
          },
          'GET /targets/buildings_1/settings/holiday-mode': {
            endDate: null,
            isEnabled: null,
            startDate: null,
          },
        },
      })

      expect(getSelect('enabled_frost_protection').value).toBe('')
      expect(getInput('min').value).toBe('')
      expect(getSelect('enabled_holiday_mode').value).toBe('')
      expect(getInput('start_date').value).toBe('')
    })

    it('should render an unconfigured panel as disabled', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/holiday-mode': null,
        },
      })

      expect(getSelect('enabled_holiday_mode').value).toBe('false')
      expect(getInput('start_date').value).toBe('')
    })

    it('should apply frost protection and cache the write', async () => {
      const harness = await bootPage()
      commit(getInput('min'), '6')
      commit(getInput('max'), '10')
      getButton('apply_frost_protection').click()
      await settleDetached()

      expect(
        lastCallBody(
          harness,
          'PUT /targets/buildings_1/settings/frost-protection',
        ),
      ).toStrictEqual({ isEnabled: true, max: 10, min: 6 })
      expect(harness.alert).toHaveBeenCalledWith('settings.success')
      expect(getButton('apply_frost_protection').disabled).toBe(true)
    })

    it('should swap and space an inverted frost range', async () => {
      const harness = await bootPage()
      commit(getInput('min'), '11')
      commit(getInput('max'), '10')
      getButton('apply_frost_protection').click()
      await settleDetached()

      // Swapped to 10/11, then the max bumped to min + gap.
      expect(
        lastCallBody(
          harness,
          'PUT /targets/buildings_1/settings/frost-protection',
        ),
      ).toStrictEqual({ isEnabled: true, max: 12, min: 10 })
    })

    it('should alert an out-of-range frost temperature', async () => {
      const harness = await bootPage()
      commit(getInput('min'), '2')
      getButton('apply_frost_protection').click()
      await settleDetached()

      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/buildings_1/settings/frost-protection',
      )

      const [message] = harness.alert.mock.calls.at(-1) ?? []

      expect(message).toContain('settings.intError')
    })

    it('should name a labelless input blank in the range error', async () => {
      const harness = await bootPage()
      document.querySelector('label[for="min"]')?.remove()
      commit(getInput('min'), '2')
      getButton('apply_frost_protection').click()
      await settleDetached()
      const [message] = harness.alert.mock.calls.at(-1) ?? []

      expect(message).toContain('"name":""')
    })

    it('should enable frost protection when a bound is set', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/frost-protection': {
            isEnabled: false,
            max: 12,
            min: 8,
          },
        },
      })

      expect(getSelect('enabled_frost_protection').value).toBe('false')

      commit(getInput('min'), '7')

      expect(getSelect('enabled_frost_protection').value).toBe('true')
    })

    it('should require an explicit choice on a mixed enabled', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/frost-protection': {
            isEnabled: null,
            max: 12,
            min: 8,
          },
        },
      })

      expect(getSelect('enabled_frost_protection').value).toBe('')

      // Editing a bound arms the gate; the mixed enabled stays unchosen.
      commit(getInput('min'), '9')
      getButton('apply_frost_protection').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.zones.enabledRequired',
      )
      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/buildings_1/settings/frost-protection',
      )
    })

    it('should refresh a frost edit back to the cache', async () => {
      await bootPage()
      commit(getInput('min'), '5')
      getButton('refresh_frost_protection').click()

      expect(getInput('min').value).toBe('8')
      expect(getButton('apply_frost_protection').disabled).toBe(true)
    })

    it('should alert when the frost write fails', async () => {
      const harness = await bootPage({
        failures: {
          'PUT /targets/buildings_1/settings/frost-protection': new Error(
            'frost down',
          ),
        },
      })
      commit(getInput('min'), '6')
      getButton('apply_frost_protection').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith('frost down')
    })

    it('should apply holiday mode with explicit dates', async () => {
      const harness = await bootPage()
      commit(getInput('start_date'), '2026-09-01T08:00')
      commit(getInput('end_date'), '2026-09-15T18:00')
      getButton('apply_holiday_mode').click()
      await settleDetached()

      expect(
        lastCallBody(harness, 'PUT /targets/buildings_1/settings/holiday-mode'),
      ).toStrictEqual({
        endDate: '2026-09-15T18:00',
        isEnabled: true,
        startDate: '2026-09-01T08:00',
      })
    })

    // The page no longer stamps a clock at all: an absent bound is the
    // app's to complete, on the HOMEY's clock — the phone stamping its
    // own here was #1595.
    it('should submit an empty start date as absent', async () => {
      const harness = await bootPage()
      commit(getInput('start_date'), '')
      commit(getInput('end_date'), '2026-09-15T18:00')
      getButton('apply_holiday_mode').click()
      await settleDetached()

      expect(
        lastCallBody(harness, 'PUT /targets/buildings_1/settings/holiday-mode'),
      ).toStrictEqual({ endDate: '2026-09-15T18:00', isEnabled: true })
    })

    it('should require an end date to enable the window', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/holiday-mode': null,
        },
      })
      commit(getSelect('enabled_holiday_mode'), 'true')
      getButton('apply_holiday_mode').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.holidayMode.endDateMissing',
      )
      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/buildings_1/settings/holiday-mode',
      )
    })

    it('should send the disable without requiring dates', async () => {
      const harness = await bootPage()
      commit(getSelect('enabled_holiday_mode'), 'false')
      getButton('apply_holiday_mode').click()
      await settleDetached()

      expect(
        lastCallBody(harness, 'PUT /targets/buildings_1/settings/holiday-mode'),
      ).toStrictEqual({ isEnabled: false })
      // Disabling cleared the dates in the form.
      expect(getInput('start_date').value).toBe('')
      expect(getInput('end_date').value).toBe('')
    })

    it('should enable the window when a date lands', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/holiday-mode': {
            endDate: null,
            isEnabled: false,
            startDate: null,
          },
        },
      })
      commit(getInput('end_date'), '2026-09-15T18:00')

      expect(getSelect('enabled_holiday_mode').value).toBe('true')
    })

    it('should render an enabled window with mixed dates blank', async () => {
      await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/holiday-mode': {
            endDate: null,
            isEnabled: true,
            startDate: null,
          },
        },
      })

      expect(getSelect('enabled_holiday_mode').value).toBe('true')
      expect(getInput('start_date').value).toBe('')
      expect(getInput('end_date').value).toBe('')
    })

    it('should require a choice on a mixed holiday enabled', async () => {
      const harness = await bootPage({
        routes: {
          ...defaultRoutes(),
          'GET /targets/buildings_1/settings/holiday-mode': {
            endDate: null,
            isEnabled: null,
            startDate: null,
          },
        },
      })
      // A landing date arms the gate without resolving the mixed enabled.
      commit(getInput('end_date'), '2026-09-15T18:00')

      expect(getSelect('enabled_holiday_mode').value).toBe('')

      getButton('apply_holiday_mode').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.zones.enabledRequired',
      )
      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/buildings_1/settings/holiday-mode',
      )
    })

    it('should disable the window when both dates clear', async () => {
      await bootPage()
      commit(getInput('start_date'), '')

      expect(getSelect('enabled_holiday_mode').value).toBe('true')

      commit(getInput('end_date'), '')

      expect(getSelect('enabled_holiday_mode').value).toBe('false')
    })

    it('should refresh holiday mode back to the cache', async () => {
      await bootPage()
      commit(getInput('start_date'), '2027-01-01T00:00')
      getButton('refresh_holiday_mode').click()

      expect(getInput('start_date').value).toBe('2026-08-10T10:00')
    })
  })

  describe('overheat panel', () => {
    it('should stay hidden for a classic zone', async () => {
      await bootPage()

      expect(getFieldset('overheat_protection_panel').hidden).toBe(true)
    })

    it('should show with the scope qualifier on a mixed building', async () => {
      await bootHome()
      commit(getSelect('zones'), 'homeBuildings_building_1')
      await settleDetached()

      expect(getFieldset('overheat_protection_panel').hidden).toBe(false)
      expect(getSpan('overheat_protection_scope').hidden).toBe(false)
    })

    it('should show without the qualifier on an ata device', async () => {
      const harness = await bootHome()
      harness.api.mockClear()
      commit(getSelect('zones'), 'homeDevices_ata_device')
      await settleDetached()

      expect(getFieldset('overheat_protection_panel').hidden).toBe(false)
      expect(getSpan('overheat_protection_scope').hidden).toBe(true)
      // The capable target also fetched its overheat panel.
      expect(calledPaths(harness)).toContain(
        'GET /targets/homeDevices_ata_device/settings/overheat-protection',
      )
    })

    it('should hide again on an atw device', async () => {
      const harness = await bootHome()
      harness.api.mockClear()
      commit(getSelect('zones'), 'homeDevices_atw_device')
      await settleDetached()

      expect(getFieldset('overheat_protection_panel').hidden).toBe(true)
      expect(calledPaths(harness)).not.toContain(
        'GET /targets/homeDevices_atw_device/settings/overheat-protection',
      )
    })

    it('should apply overheat protection to a home building', async () => {
      const harness = await bootHome()
      commit(getSelect('zones'), 'homeBuildings_building_1')
      await settleDetached()
      commit(getSelect('enabled_overheat_protection'), 'true')
      commit(getInput('overheat_min'), '33')
      commit(getInput('overheat_max'), '38')
      getButton('apply_overheat_protection').click()
      await settleDetached()

      expect(
        lastCallBody(
          harness,
          'PUT /targets/homeBuildings_building_1/settings/overheat-protection',
        ),
      ).toStrictEqual({ isEnabled: true, max: 38, min: 33 })
    })

    it('should alert an invalid overheat range', async () => {
      const harness = await bootHome()
      commit(getSelect('zones'), 'homeDevices_ata_device')
      await settleDetached()
      commit(getSelect('enabled_overheat_protection'), 'true')
      commit(getInput('overheat_min'), 'not-a-number')
      getButton('apply_overheat_protection').click()
      await settleDetached()

      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/homeDevices_ata_device/settings/overheat-protection',
      )

      const [message] = harness.alert.mock.calls.at(-1) ?? []

      expect(message).toContain('settings.intError')
    })

    it('should require a choice on a mixed building overheat', async () => {
      const harness = await bootHome({
        routes: {
          'GET /targets/homeBuildings_building_1/settings/overheat-protection':
            { isEnabled: null, max: null, min: null },
        },
      })
      commit(getSelect('zones'), 'homeBuildings_building_1')
      await settleDetached()

      expect(getSelect('enabled_overheat_protection').value).toBe('')

      commit(getInput('overheat_min'), '33')
      getButton('apply_overheat_protection').click()
      await settleDetached()

      expect(harness.alert).toHaveBeenCalledWith(
        'settings.zones.enabledRequired',
      )
      expect(calledPaths(harness)).not.toContain(
        'PUT /targets/homeBuildings_building_1/settings/overheat-protection',
      )
    })

    it('should keep the form on a refresh of an unfetched target', async () => {
      await bootHome({
        failures: {
          'GET /targets/homeDevices_ata_device/settings/frost-protection':
            new Error('down'),
          'GET /targets/homeDevices_ata_device/settings/holiday-mode':
            new Error('down'),
          'GET /targets/homeDevices_ata_device/settings/overheat-protection':
            new Error('down'),
        },
      })
      commit(getSelect('zones'), 'homeDevices_ata_device')
      await settleDetached()
      // Nothing cached for the target: a refresh only re-baselines.
      commit(getInput('overheat_min'), '35')
      getButton('refresh_overheat_protection').click()

      expect(getInput('overheat_min').value).toBe('35')
      expect(getButton('apply_overheat_protection').disabled).toBe(true)
    })

    it('should mark a buildingless device capable on its own', async () => {
      // Two devices: happy-dom only resolves a select's default selection
      // once a second option lands, and real targets never come alone
      // anyway (a lone device implies a building-less account snapshot).
      await bootHome({
        routes: {
          'GET /home/targets': [
            {
              buildingName: 'Villa',
              deviceType: 'ata',
              id: 'ata_device',
              level: 1,
              model: 'homeDevices',
              name: 'Salon',
            },
            {
              buildingName: 'Villa',
              deviceType: 'ata',
              id: 'ata_device_2',
              level: 1,
              model: 'homeDevices',
              name: 'Bureau',
            },
          ],
        },
      })

      // No building precedes the ATA devices in the flat target list: each
      // device carries the panel alone, with no scope qualifier anywhere.
      expect(getSelect('zones').value).toBe('homeDevices_ata_device')
      expect(getFieldset('overheat_protection_panel').hidden).toBe(false)
      expect(getSpan('overheat_protection_scope').hidden).toBe(true)
    })

    it('should refresh the overheat panel from the cache', async () => {
      await bootHome()
      commit(getSelect('zones'), 'homeDevices_ata_device')
      await settleDetached()
      commit(getInput('overheat_min'), '35')
      getButton('refresh_overheat_protection').click()

      expect(getInput('overheat_min').value).toBe('')
      expect(getButton('apply_overheat_protection').disabled).toBe(true)
    })
  })
})
