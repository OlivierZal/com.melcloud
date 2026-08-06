import type {
  HolidayModeState,
  HolidayModeUpdate,
  LoginCredentials,
  ProtectionState,
  ProtectionUpdate,
} from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type Homey from 'homey/lib/HomeySettings'
import { Temporal } from 'temporal-polyfill'

import type { Api } from '../types/api.mts'
import type { HomeySettings } from '../types/app-settings.mts'
import type {
  DeviceSetting,
  DeviceSettings,
  Settings,
} from '../types/device-settings.mts'
import type {
  DriverSetting,
  LoginDriverSetting,
} from '../types/driver-settings.mts'
import type {
  ErrorLogQueryParams,
  FormattedErrorDetails,
  FormattedErrorLog,
} from '../types/error-log.mts'
import type { HomeBuildingZone, HomeDeviceZone } from '../types/zone.mts'
import { getErrorMessage } from '../lib/get-error-message.mts'
import { type DirtyGate, createDirtyGate } from '../public/dirty-gate.mts'
import {
  type HTMLValueElement,
  booleanStrings,
  configureNumericInput,
  createOption,
  getButton,
  getDetails,
  getDiv,
  getFieldset,
  getInput,
  getSelect,
  getSpan,
  translateAriaLabels,
} from '../public/dom.mts'
import { fireAndForget, runWebview } from '../public/homey-api.mts'
import { ensureFreshWebview } from '../public/webview-freshness.mts'
import {
  getHomeBuildingId,
  getHomeDeviceId,
  getZoneId,
  getZoneName,
  getZonePath,
  isHomeBuildingValue,
  isHomeDeviceValue,
} from '../public/zones.mts'
import {
  homeyApiDelete,
  homeyApiGet,
  homeyApiPost,
  homeyApiPut,
  homeyCallback,
  homeyConfirm,
} from './callback-api.mts'

// ── Helpers ──

interface CheckboxGroup {
  readonly label: string
  readonly settings: DriverSetting[]
}

const openGroup = (groups: CheckboxGroup[], label: string): DriverSetting[] => {
  const settings: DriverSetting[] = []
  groups.push({ label, settings })
  return settings
}

// Checkbox settings grouped by consecutive group label (a repeated
// label later in the list deliberately opens a new group, matching the
// manifest order).
const groupCheckboxSettings = (
  driverSetting: readonly DriverSetting[],
): CheckboxGroup[] => {
  const checkboxes = driverSetting.filter(({ type }) => type === 'checkbox')
  const groups: CheckboxGroup[] = []
  let current: DriverSetting[] = []
  let currentLabel: string | null = null
  for (const setting of checkboxes) {
    if ((setting.groupLabel ?? '') !== currentLabel) {
      currentLabel = setting.groupLabel ?? ''
      current = openGroup(groups, currentLabel)
    }
    current.push(setting)
  }
  return groups
}

// Password-manager and keyboard hints: the username is an email
// address, so iOS auto-capitalization and autocorrect only get in the
// way.
const applyCredentialHints = (
  input: HTMLInputElement,
  credentialKey: keyof LoginCredentials,
): void => {
  if (credentialKey === 'password') {
    input.autocomplete = 'current-password'
    return
  }
  input.autocomplete = 'username'
  input.autocapitalize = 'none'
  input.spellcheck = false
}

// ── DOM helpers ──

const Modulo = { base10: 10, base100: 100 } as const

// Slavic plural rules: numbers ending in 2/3/4 use a special plural
// form, except 12-14 which use the regular plural
const PLURAL_THRESHOLD = 2
const slavicPaucal = { maxEnding: 4, minEnding: 2, teenMax: 14, teenMin: 12 }

const frostProtectionTemperatureRange = { max: 16, min: 4 }
const overheatProtectionTemperatureRange = { max: 40, min: 31 }
const PROTECTION_TEMPERATURE_GAP = 2

const commonElementTypes = new Set(['checkbox', 'dropdown'])

// Every Home driver: a Home account counts as "has devices" when any of
// them has paired devices (an ATW-only account is as real as an
// ATA-only one).
const HOME_DRIVER_IDS: readonly string[] = [
  'home-melcloud',
  'home-melcloud_atw',
]

// The two APIs, in the order the picker offers them; also the priority
// order when auto-selecting an account whose credentials are missing.
const API_VALUES: readonly Api[] = ['classic', 'home']

class NoDeviceError extends Error {
  public override name = 'NoDeviceError'

  public constructor(homey: Homey, options?: ErrorOptions) {
    super(homey.__('settings.devices.none'), options)
  }
}

class NoClassicDeviceError extends NoDeviceError {
  public override name = 'NoClassicDeviceError'
}

// Native `disabled` (not a CSS class): it also blocks keyboard activation
// during in-flight actions and is announced by screen readers. getButton
// throws on a missing/mistyped id so a renamed button fails fast instead
// of silently reintroducing double submission.
const disableButton = (id: string, isDisabled = true): void => {
  getButton(id).disabled = isDisabled
}

const withDisablingButton = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(id)
  try {
    await action()
  } finally {
    disableButton(id, false)
  }
}

const hide = (element: HTMLElement, isHidden = true): void => {
  element.hidden = isHidden
}

// The zone/device settings fieldset (frost protection + holiday mode) is
// shown whenever either account is signed in: Classic contributes its zone
// tree, Home its individual devices.
const toggleZoneDeviceSettings = (isVisible: boolean): void => {
  for (const fieldset of document.querySelectorAll<HTMLFieldSetElement>(
    '.zone-device-settings',
  )) {
    fieldset.hidden = !isVisible
  }
}

const addTextToCheckbox = (
  label: HTMLLabelElement,
  checkbox: HTMLInputElement,
  text: string,
): void => {
  const checkmarkSpan = document.createElement('span')
  checkmarkSpan.classList.add('homey-form-checkbox-checkmark')
  const textSpan = document.createElement('span')
  textSpan.classList.add('homey-form-checkbox-text')
  textSpan.textContent = text
  label.append(checkbox, checkmarkSpan, textSpan)
}

const createLabel = (
  formControl: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const isCheckbox = formControl.type === 'checkbox'
  const label = document.createElement('label')
  label.classList.add(isCheckbox ? 'homey-form-checkbox' : 'homey-form-label')
  label.htmlFor = formControl.id
  if (isCheckbox) {
    addTextToCheckbox(label, formControl, text)
    return label
  }
  label.textContent = text
  label.append(formControl)
  return label
}

const createDiv = (label: HTMLLabelElement): HTMLDivElement => {
  const div = document.createElement('div')
  div.classList.add('homey-form-group')
  div.append(label)
  return div
}

const appendFormControl = (
  parent: HTMLElement,
  {
    formControl,
    title,
  }: { formControl: HTMLValueElement | null; title: string },
  shouldWrapWithDiv = true,
): void => {
  if (formControl === null) {
    return
  }

  const label = createLabel(formControl, title)
  parent.append(shouldWrapWithDiv ? createDiv(label) : label)
}

const createInput = ({
  id,
  max,
  min,
  placeholder,
  type,
  value,
}: {
  id: string
  type: string
  max?: number
  min?: number
  placeholder?: string | undefined
  value?: string | null
}): HTMLInputElement => {
  const input = document.createElement('input')
  input.classList.add('homey-form-input')
  input.id = id
  input.value = value ?? ''
  input.type = type
  configureNumericInput(input, { max, min })
  if (placeholder !== undefined) {
    input.placeholder = placeholder
  }
  return input
}

const createLegend = (fieldSet: HTMLFieldSetElement, text?: string): void => {
  const legend = document.createElement('legend')
  legend.classList.add('homey-form-checkbox-set-title')
  if (text !== undefined) {
    legend.textContent = text
  }
  fieldSet.append(legend)
}

// The generated buttons carry snake_case ids (html lint) while driver ids
// may carry a hyphen (the Home drivers): the two are kept in lockstep here,
// so generation and lookup never drift.
const toSectionId = (driverId: string): string => driverId.replaceAll('-', '_')

// The temperature auto-adjust link (the companion extension app) covers
// both air-to-air drivers — the extension targets the Classic and the Home
// ATA driver ids alike — so its section shows when either has devices.
const ATA_DRIVER_IDS = ['melcloud', 'home-melcloud']

const createSettingsButton = (
  homey: Homey,
  action: 'apply' | 'refresh',
  sectionId: string,
): HTMLButtonElement => {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = `${action}_settings_${sectionId}`
  button.classList.add(
    action === 'apply'
      ? 'homey-button-danger-shadow'
      : 'homey-button-secondary-shadow',
  )
  button.textContent = homey.__(
    action === 'apply' ? 'settings.update' : 'settings.refresh',
  )
  return button
}

const createSectionShell = (
  legendText: string,
): { controls: HTMLDivElement; section: HTMLFieldSetElement } => {
  const section = document.createElement('fieldset')
  section.classList.add('homey-form-fieldset')
  const legend = document.createElement('legend')
  legend.classList.add('homey-form-legend')
  legend.textContent = legendText
  const controls = document.createElement('div')
  controls.classList.add('homey-form-group')
  section.append(legend, controls)
  return { controls, section }
}

const createSettingsButtonRow = (
  homey: Homey,
  sectionId: string,
): HTMLDivElement => {
  const buttons = document.createElement('div')
  buttons.classList.add('homey-form-group', 'container')
  buttons.append(
    createSettingsButton(homey, 'refresh', sectionId),
    createSettingsButton(homey, 'apply', sectionId),
  )
  return buttons
}

const createCheckbox = (id: string, driverId: string): HTMLInputElement => {
  const checkbox = document.createElement('input')
  checkbox.classList.add('homey-form-checkbox-input')
  checkbox.type = 'checkbox'
  checkbox.id = `${id}_${driverId}`
  checkbox.dataset.settingId = id
  checkbox.dataset.driverId = driverId
  return checkbox
}

const createSelect = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const select = document.createElement('select')
  select.classList.add('homey-form-select')
  select.id = id
  for (const option of [
    { id: '', label: '' },
    ...(values ??
      booleanStrings.map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ]) {
    createOption(select, option)
  }
  return select
}

const parseNumericInput = (
  homey: Homey,
  { id, max, min, value }: HTMLInputElement,
): number => {
  const numberValue = Number(value)
  if (
    !Number.isFinite(numberValue) ||
    numberValue < Number(min) ||
    numberValue > Number(max)
  ) {
    const label = document.querySelector<HTMLLabelElement>(
      `label[for="${CSS.escape(id)}"]`,
    )
    throw new Error(
      homey.__('settings.intError', {
        max,
        min,
        name: homey.__(label?.textContent ?? ''),
      }),
    )
  }
  return numberValue
}

const initProtectionMin = (
  id: string,
  range: { max: number; min: number },
): HTMLInputElement => {
  const element = getInput(id)
  element.min = String(range.min)
  element.max = String(range.max - PROTECTION_TEMPERATURE_GAP)
  return element
}

const initProtectionMax = (
  id: string,
  range: { max: number; min: number },
): HTMLInputElement => {
  const element = getInput(id)
  element.min = String(range.min + PROTECTION_TEMPERATURE_GAP)
  element.max = String(range.max)
  return element
}

// One zone-panel DirtyGate: Apply/Refresh and the panel's fieldset are
// looked up from the panel's id prefix, pristine = the serialized values
// of its controls.
const createValuesGate = (
  prefix: string,
  elements: readonly HTMLValueElement[],
): DirtyGate =>
  createDirtyGate({
    applyElement: getButton(`apply_${prefix}`),
    fieldsetElements: [getFieldset(`${prefix}_panel`)],
    refreshElements: [getButton(`refresh_${prefix}`)],
    serialize: (): string =>
      JSON.stringify(elements.map((element) => element.value)),
  })

// Everything the zone picker can list: a Classic zone at any level, or a
// Home building and its devices. Named once because the three overheat
// helpers and `populateZoneOptions` all speak it.
type PickerZone = Classic.Zone | HomeBuildingZone | HomeDeviceZone

// Option values driving the Home-only overheat panel: `capable` lists
// every Home ATA device plus each building owning one (the flat target
// list puts a building right before its devices); `atwBuildings` lists
// the buildings owning at least one ATW, so a capable building can show
// the "(air-to-air)" scope qualifier when its bulk write skips ATW.
const collectOverheatZoneValues = (
  zones: readonly PickerZone[],
): { atwBuildings: string[]; capable: string[] } => {
  const atwBuildings: string[] = []
  const capable: string[] = []
  let buildingValue: string | null = null
  for (const zone of zones) {
    if (zone.model === 'homeBuildings') {
      buildingValue = getZoneId(zone.id, zone.model)
    } else if (zone.model === 'homeDevices' && zone.deviceType === 'ata') {
      capable.push(
        getZoneId(zone.id, zone.model),
        ...(buildingValue === null ? [] : [buildingValue]),
      )
    } else if (buildingValue !== null && zone.model === 'homeDevices') {
      atwBuildings.push(buildingValue)
    }
  }
  return { atwBuildings, capable }
}

const getSubzones = (zone: PickerZone): Classic.Zone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

// Serialize a device-settings section's controls as a pure form snapshot for
// its DirtyGate — the same value-only shape the frost/holiday gates use. A
// checkbox contributes its checked state plus its indeterminate ("mixed
// across devices") flag; every other control contributes its value.
const serializeSettingElements = (elements: HTMLValueElement[]): string =>
  JSON.stringify(
    elements.map((element) =>
      element instanceof HTMLInputElement && element.type === 'checkbox'
        ? [element.checked, element.indeterminate]
        : element.value,
    ),
  )

// Panel values, where a field may be `null` to mean "mixed" across a Home
// building's devices — rendered indeterminate (blank).
// A field reads `null` when a Home building's devices disagree on it
// ("mixed"), which the panels render as blank.
type Mixable<T> = { readonly [K in keyof T]: T[K] | null }

// The three panels share one cache entry per target, so each keeps its own
// slot: frost and overheat carry the same neutral protection shape and
// would otherwise overwrite each other.
interface MixableZoneSettings {
  readonly frost_protection?: Mixable<ProtectionState> | null
  readonly holiday_mode?: Mixable<HolidayModeState> | null
  readonly overheat_protection?: Mixable<ProtectionState> | null
}

// One protection panel — frost, holiday or overheat: its button-pair
// id, its endpoint suffix, and the display refresh bound to it.
interface ZoneSettingDescriptor {
  readonly id: 'frost_protection' | 'holiday_mode' | 'overheat_protection'
  readonly path: 'frost-protection' | 'holiday-mode' | 'overheat-protection'
  readonly display: () => void
}

// ── AuthManager ──
class AuthManager {
  readonly #apiSelect: HTMLSelectElement

  readonly #authenticateButton: HTMLButtonElement

  readonly #authenticationSection: HTMLDetailsElement

  #credentialsByApi: Record<Api, Partial<LoginCredentials>> = {
    classic: {},
    home: {},
  }

  readonly #gate: DirtyGate

  readonly #homey: Homey

  readonly #loadPostLoginCallback: (api: Api) => Promise<void>

  readonly #loginSection: HTMLDivElement

  readonly #onLogOutCallback: (api: Api) => void

  #passwordInput: HTMLInputElement | null = null

  readonly #resetButton: HTMLButtonElement

  #usernameInput: HTMLInputElement | null = null

  get #currentApi(): Api {
    return this.#apiSelect.value === 'home' ? 'home' : 'classic'
  }

  // Trimmed: mobile keyboards append a space after autocompleted
  // email addresses, invisible in the field and rejected by MELCloud.
  get #loginInput(): LoginCredentials {
    return {
      password: this.#passwordInput?.value ?? '',
      username: (this.#usernameInput?.value ?? '').trim(),
    }
  }

  public constructor(
    homey: Homey,
    loadPostLoginCallback: (api: Api) => Promise<void>,
    onLogOutCallback: (api: Api) => void,
  ) {
    this.#homey = homey
    this.#loadPostLoginCallback = loadPostLoginCallback
    this.#onLogOutCallback = onLogOutCallback
    this.#apiSelect = getSelect('api')
    this.#authenticateButton = getButton('authenticate')
    this.#authenticationSection = getDetails('authentication')
    this.#loginSection = getDiv('login')
    this.#resetButton = getButton('reset_credentials')
    this.#gate = createDirtyGate({
      applyElement: this.#authenticateButton,
      fieldsetElements: [getFieldset('login_panel')],
      refreshElements: [this.#resetButton],
      // Arms only when both fields carry something: an empty field
      // could only produce the "missing credentials" alert, never a
      // request.
      isActionable: (): boolean => {
        const { password, username } = this.#loginInput
        return username !== '' && password !== ''
      },
      serialize: (): string =>
        JSON.stringify([
          this.#apiSelect.value,
          this.#usernameInput?.value ?? '',
          this.#passwordInput?.value ?? '',
        ]),
    })
  }

  public addEventListeners(): void {
    this.#apiSelect.addEventListener('change', () => {
      this.#syncInputsFromCredentials()
    })
    this.#authenticateButton.addEventListener('click', () => {
      fireAndForget(this.login())
    })
    this.#resetButton.addEventListener('click', () => {
      fireAndForget(this.resetCredentials())
    })
    // Wired last so the dirty recompute runs after the API cascade has
    // resynced the fields the snapshot reads.
    this.#gate.wire(
      [this.#apiSelect, this.#usernameInput, this.#passwordInput].filter(
        (element) => element !== null,
      ),
    )
  }

  // Folded when the credentials are settled, expanded while attention
  // is needed.
  public collapseAuthenticationSection(isCollapsed: boolean): void {
    this.#authenticationSection.open = !isCollapsed
  }

  public createCredentialFields(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    credentials: Record<Api, Partial<LoginCredentials>>,
    unauthenticatedApis: readonly Api[],
  ): void {
    this.#credentialsByApi = credentials
    this.#usernameInput = this.#createCredentialInput(
      'username',
      driverSettings,
    )
    this.#passwordInput = this.#createCredentialInput(
      'password',
      driverSettings,
    )
    // Open on the account that needs attention so what the user sees
    // first is the account to fix: a signed-out one before anything
    // else — stored-but-refused credentials included — then one whose
    // stored pair lost a field.
    this.#selectApiNeedingAttention(unauthenticatedApis)
    this.#syncInputsFromCredentials()
    this.#gate.markSaved()
  }

  // APIs whose stored credentials are missing a username or password —
  // the accounts the app cannot sign back in to.
  public getIncompleteApis(): Api[] {
    return API_VALUES.filter((api) => !this.#hasCompleteCredentials(api))
  }

  /**
   * @alerts Displays authentication errors to the user.
   */
  public async login(): Promise<void> {
    const api = this.#currentApi
    const { password, username } = this.#loginInput
    // Belt for the arming predicate: keyboard activation of a stale
    // reference could still submit an emptied form.
    if (username === '' || password === '') {
      fireAndForget(
        this.#homey.alert(this.#homey.__('settings.authenticate.failure')),
      )
      return
    }
    await this.#gate.runBusy(async () => {
      try {
        await homeyApiPost(this.#homey, `/${api}/sessions`, {
          password,
          username,
        } satisfies LoginCredentials)
        this.#credentialsByApi[api] = { password, username }
        await this.#loadPostLoginCallback(api)
      } catch (error) {
        // The app-side handler already classified the failure into a
        // user-facing reason (rejected / throttled / transport).
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  /**
   * @alerts Displays reset failures to the user.
   */
  public async resetCredentials(): Promise<void> {
    if (
      !(await homeyConfirm(
        this.#homey,
        this.#homey.__('settings.authenticate.resetConfirm'),
      ))
    ) {
      return
    }
    const api = this.#currentApi
    await this.#gate.runBusy(async () => {
      try {
        // The app-side logout owns the teardown (session, credentials,
        // backoff, sync timer, registry) — the webview never touches the
        // library's persisted keys.
        await homeyApiDelete(this.#homey, `/${api}/sessions`)
        this.#credentialsByApi[api] = {}
        this.#syncInputsFromCredentials()
        this.#gate.markSaved()
        this.#onLogOutCallback(api)
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  #createCredentialInput(
    credentialKey: keyof LoginCredentials,
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): HTMLInputElement | null {
    const loginSetting = driverSettings.login?.find(
      (setting): setting is LoginDriverSetting => setting.id === credentialKey,
    )
    if (loginSetting !== undefined) {
      const { id, placeholder, title, type } = loginSetting
      const formControl = createInput({ id, placeholder, type })
      applyCredentialHints(formControl, credentialKey)
      appendFormControl(this.#loginSection, { formControl, title })
      return formControl
    }
    return null
  }

  #hasCompleteCredentials(api: Api): boolean {
    const { password, username } = this.#credentialsByApi[api]
    return (username ?? '') !== '' && (password ?? '') !== ''
  }

  #selectApiNeedingAttention(unauthenticatedApis: readonly Api[]): void {
    const [needsAttention] = [
      ...unauthenticatedApis,
      ...this.getIncompleteApis(),
    ]
    if (needsAttention !== undefined) {
      this.#apiSelect.value = needsAttention
    }
  }

  #syncInputsFromCredentials(): void {
    const { password, username } = this.#credentialsByApi[this.#currentApi]
    if (this.#usernameInput !== null) {
      this.#usernameInput.value = username ?? ''
    }
    if (this.#passwordInput !== null) {
      this.#passwordInput.value = password ?? ''
    }
  }
}

// ── DeviceSettingsManager ──
class DeviceSettingsManager {
  public get deviceSettings(): Partial<DeviceSettings> {
    return this.#deviceSettings
  }

  // Folded with a Map rather than `Object.groupBy`: the webview must run
  // on engines older than Safari 17.4, and esbuild only lowers syntax,
  // never runtime APIs.
  public get flatDeviceSettings(): Partial<DeviceSetting> {
    const valuesById = new Map<string, Set<unknown>>()
    const allSettings = Object.values(this.#deviceSettings)
    for (const settings of allSettings) {
      const entries = Object.entries(settings ?? {})
      for (const [id, values] of entries) {
        const set = valuesById.get(id) ?? new Set()
        set.add(values)
        valuesById.set(id, set)
      }
    }
    return Object.fromEntries(
      [...valuesById].map(([id, set]) => [
        id,
        set.size === 1 ? set.values().next().value : null,
      ]),
    )
  }

  #deviceSettings: Partial<DeviceSettings> = {}

  // One DirtyGate per device-settings section, keyed by section id
  // (`common` or a driver's `toSectionId`). The per-driver gates are added
  // as their sections are appended, so a common apply — which writes every
  // driver — can reach and lock them all for the round-trip.
  readonly #dirtyGates = new Map<string, DirtyGate>()

  readonly #homey: Homey

  readonly #settingsCommon: HTMLDivElement

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#settingsCommon = getDiv('settings_common')
  }

  /**
   * @alerts Displays fetch errors to the user.
   */
  public async fetchDeviceSettings(): Promise<void> {
    try {
      this.#deviceSettings = await homeyApiGet<DeviceSettings>(
        this.#homey,
        '/settings/devices',
      )
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
    }
  }

  /**
   * @alerts Displays fetch errors to the user. Returns empty fallback on error.
   */
  public async fetchDriverSettings(): Promise<
    Partial<Record<string, DriverSetting[]>>
  > {
    try {
      const settings = await homeyApiGet<
        Partial<Record<string, DriverSetting[]>>
      >(this.#homey, '/settings/drivers')
      this.#createSettingControls(settings)
      return settings
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
      return {}
    }
  }

  #alertNoChanges(elements: HTMLValueElement[], driverId?: string): void {
    if (driverId === undefined) {
      this.#syncCommonSettings(
        elements.filter((element) => element instanceof HTMLSelectElement),
      )
    }
    fireAndForget(this.#homey.alert(this.#homey.__('settings.devices.nothing')))
  }

  #appendDriverSection(
    driverId: string,
    driverLabel: string,
    checkboxSets: HTMLFieldSetElement[],
  ): void {
    const { controls, section } = createSectionShell(driverLabel)
    controls.append(...checkboxSets)
    section.append(createSettingsButtonRow(this.#homey, toSectionId(driverId)))
    getDiv('device_settings').append(section)
    this.#registerSettingsSection(
      checkboxSets.flatMap((checkboxSet) => [
        ...checkboxSet.querySelectorAll('input'),
      ]),
      section,
      driverId,
    )
  }

  async #applyDeviceSettings(body: Settings, driverId?: string): Promise<void> {
    const driverQuery =
      driverId === undefined
        ? ''
        : `?${new URLSearchParams({ driverId } satisfies { driverId: string })}`
    await homeyApiPut<unknown>(
      this.#homey,
      `/settings/devices${driverQuery}`,
      body satisfies Settings,
    )
    this.#updateDeviceSettings(body, driverId)
    await this.#homey.alert(this.#homey.__('settings.success'))
  }

  #buildSettingsBody(elements: HTMLValueElement[]): Settings {
    const errors: string[] = []
    const settings: Settings = {}
    for (const element of elements) {
      try {
        this.#setSetting(settings, element)
      } catch (error) {
        errors.push(getErrorMessage(error))
      }
    }
    if (errors.length > 0) {
      const message = errors.join('\n')
      throw new Error(message === '' ? 'Unknown error' : message)
    }
    return settings
  }

  // One fieldset per checkbox group, its (single) legend as first
  // child: several legends in one fieldset are invalid HTML and screen
  // readers name the whole set after the first one only.
  #createCheckboxSet(
    label: string,
    settings: DriverSetting[],
  ): HTMLFieldSetElement {
    const checkboxSet = document.createElement('fieldset')
    checkboxSet.classList.add('homey-form-checkbox-set')
    if (label !== '') {
      createLegend(checkboxSet, label)
    }
    for (const { driverId, id, title } of settings) {
      const formControl = createCheckbox(id, driverId)
      appendFormControl(checkboxSet, { formControl, title }, false)
      this.#updateDriverSetting(formControl)
    }
    return checkboxSet
  }

  #createCheckboxSets(driverSetting: DriverSetting[]): HTMLFieldSetElement[] {
    return groupCheckboxSettings(driverSetting).map(({ label, settings }) =>
      this.#createCheckboxSet(label, settings),
    )
  }

  #createCommonSettingControls(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    const options = driverSettings.options ?? []
    for (const { id, title, type, values } of options) {
      if (!(
        this.#settingsCommon.querySelector(
          `select[data-setting-id="${CSS.escape(id)}"]`,
        ) === null && commonElementTypes.has(type)
      )) {
        continue
      }

      const formControl = createSelect(this.#homey, id, values)
      formControl.dataset.settingId = id
      formControl.dataset.driverId = 'common'
      appendFormControl(this.#settingsCommon, { formControl, title })
      this.#updateCommonSetting(formControl)
    }
    this.#registerSettingsSection(
      [...this.#settingsCommon.querySelectorAll('select')],
      getFieldset('settings_common_section'),
    )
  }

  // One section per driver that has devices, built from the driver's own
  // settings — legend is the driver's manifest name, so adding a driver
  // needs no markup. The buttons' snake_case ids match what the apply and
  // refresh listeners look up through `toSectionId`.
  #createDriverSettingSection(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    driverId: string,
  ): void {
    const driverSetting = driverSettings[driverId]
    const [firstSetting] = driverSetting ?? []
    if (driverSetting === undefined || firstSetting === undefined) {
      return
    }
    // No checkbox settings, no section: an empty shell would still
    // render its legend and buttons.
    const checkboxSets = this.#createCheckboxSets(driverSetting)
    if (checkboxSets.length > 0) {
      this.#appendDriverSection(
        driverId,
        firstSetting.driverLabel,
        checkboxSets,
      )
    }
  }

  #createSettingControls(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    this.#createCommonSettingControls(driverSettings)
    for (const driverId of Object.keys(this.#deviceSettings)) {
      this.#createDriverSettingSection(driverSettings, driverId)
    }
    if (
      ATA_DRIVER_IDS.some((driverId) =>
        Object.hasOwn(this.#deviceSettings, driverId),
      )
    ) {
      hide(getDiv('auto_adjust_section'), false)
    }
  }

  #parseFormValue(element: HTMLValueElement): Settings[keyof Settings] {
    if (element.value !== '') {
      if (element.type === 'checkbox') {
        return element.indeterminate ? null : element.checked
      }
      if (
        element.type === 'number' &&
        element.min !== '' &&
        element.max !== ''
      ) {
        return parseNumericInput(this.#homey, element)
      }
      if (booleanStrings.includes(element.value)) {
        return element.value === 'true'
      }
      const numberValue = Number(element.value)
      return Number.isFinite(numberValue) ? numberValue : element.value
    }
    return null
  }

  // Re-sync a section's controls from the cached device settings (client-side,
  // no round-trip), then re-baseline its gate so Apply drops back to disabled.
  #refreshSettings(
    gate: DirtyGate,
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    this.#syncSettings(elements, driverId)
    gate.markSaved()
  }

  // Build and wire one device-settings section's DirtyGate (the common one
  // when `driverId` is omitted, else a driver's), keyed by section id in
  // `#dirtyGates`. The gate snapshots the freshly populated controls at
  // creation, so Apply starts disabled until an edit diverges from them.
  #registerSettingsSection(
    elements: HTMLValueElement[],
    sectionElement: HTMLFieldSetElement,
    driverId?: string,
  ): void {
    const sectionId = toSectionId(driverId ?? 'common')
    const applyElement = getButton(`apply_settings_${sectionId}`)
    const refreshElement = getButton(`refresh_settings_${sectionId}`)
    const gate = createDirtyGate({
      applyElement,
      fieldsetElements: [sectionElement],
      refreshElements: [refreshElement],
      serialize: () => serializeSettingElements(elements),
    })
    this.#dirtyGates.set(sectionId, gate)
    gate.wire(elements)
    applyElement.addEventListener('click', () => {
      fireAndForget(this.#submitDeviceSettings(gate, elements, driverId))
    })
    refreshElement.addEventListener('click', () => {
      this.#refreshSettings(gate, elements, driverId)
    })
  }

  // Toggle a section's busy state on its gate(s): the common section fans
  // out to every registered gate (its apply writes all drivers), a driver
  // section touches only its own. Iterates the map directly — an old-engine
  // webview has no `Iterator#toArray`.
  #setSectionBusy(
    gate: DirtyGate,
    driverId: string | undefined,
    areBusy: boolean,
  ): void {
    if (driverId === undefined) {
      for (const sectionGate of this.#dirtyGates.values()) {
        sectionGate.setBusy(areBusy)
      }
      return
    }
    gate.setBusy(areBusy)
  }

  #setSetting(settings: Settings, element: HTMLValueElement): void {
    const {
      dataset: { driverId, settingId },
    } = element
    if (settingId !== undefined) {
      const value = this.#parseFormValue(element)
      if (
        this.#shouldUpdate(
          settingId,
          value,
          driverId === 'common' ? undefined : driverId,
        )
      ) {
        settings[settingId] = value
      }
    }
  }

  #shouldUpdate(
    id: string,
    value: Settings[keyof Settings],
    driverId?: string,
  ): boolean {
    if (value === null) {
      return false
    }
    const settings =
      driverId === undefined
        ? this.flatDeviceSettings
        : (this.#deviceSettings[driverId] ?? {})
    const setting = settings[id]
    return setting === null || value !== setting
  }

  async #submitDeviceSettings(
    gate: DirtyGate,
    elements: HTMLValueElement[],
    driverId?: string,
  ): Promise<void> {
    const body = this.#buildSettingsBody(elements)
    if (Object.keys(body).length === 0) {
      // Safety net: the Apply button is disabled while the section is
      // pristine, so this is reached only when a dirty edit nets no
      // update (a blank select, a re-toggled checkbox). Re-baseline so
      // Apply drops back to disabled.
      this.#alertNoChanges(elements, driverId)
      gate.markSaved()
      return
    }
    await this.#withSectionBusy(gate, driverId, async () => {
      try {
        await this.#applyDeviceSettings(body, driverId)
        gate.markSaved()
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  #syncCommonSettings(elements: HTMLSelectElement[]): void {
    for (const element of elements) {
      this.#updateCommonSetting(element)
    }
  }

  #syncDriverSettings(elements: HTMLInputElement[]): void {
    for (const element of elements) {
      this.#updateDriverSetting(element)
    }
  }

  // Dispatch a refresh to the right per-type sync: the common section holds
  // selects, a driver section holds checkbox inputs.
  #syncSettings(elements: HTMLValueElement[], driverId?: string): void {
    if (driverId === undefined) {
      this.#syncCommonSettings(
        elements.filter((element) => element instanceof HTMLSelectElement),
      )
      return
    }
    this.#syncDriverSettings(
      elements.filter((element) => element instanceof HTMLInputElement),
    )
  }

  #updateCommonSetting(element: HTMLSelectElement): void {
    const {
      dataset: { settingId },
    } = element
    if (settingId !== undefined) {
      const value = this.flatDeviceSettings[settingId]
      element.value =
        typeof value === 'boolean' ||
        typeof value === 'number' ||
        typeof value === 'string'
          ? String(value)
          : ''
    }
  }

  #updateDeviceSettings(body: Settings, driverId?: string): void {
    const drivers =
      driverId === undefined ? Object.keys(this.#deviceSettings) : [driverId]
    for (const [id, value] of Object.entries(body)) {
      for (const driver of drivers) {
        this.#deviceSettings[driver] ??= {}
        this.#deviceSettings[driver][id] = value
      }
    }
  }

  #updateDriverSetting(element: HTMLInputElement): void {
    const {
      dataset: { driverId, settingId },
    } = element
    if (settingId !== undefined && driverId !== undefined) {
      const isChecked = this.#deviceSettings[driverId]?.[settingId]
      if (typeof isChecked === 'boolean') {
        element.checked = isChecked
        return
      }
      element.indeterminate = true
      element.addEventListener(
        'change',
        () => {
          element.indeterminate = false
        },
        { once: true },
      )
    }
  }

  // Run a section's apply with its buttons busy-locked, unlocking in a
  // `finally`. A per-driver apply locks only its own gate; a common apply
  // writes every driver, so it locks every section's gate for the round-trip
  // (preventing a concurrent submit against the settings it will overwrite).
  async #withSectionBusy(
    gate: DirtyGate,
    driverId: string | undefined,
    action: () => Promise<void>,
  ): Promise<void> {
    this.#setSectionBusy(gate, driverId, true)
    try {
      await action()
    } finally {
      this.#setSectionBusy(gate, driverId, false)
    }
  }
}

// ── ErrorLogManager ──
class ErrorLogManager {
  #errorCount = 0

  readonly #errorCountLabel: HTMLSpanElement

  readonly #errorLog: HTMLDivElement

  #errorLogTBody: HTMLTableSectionElement | null = null

  #from = ''

  readonly #homey: Homey

  readonly #periodLabel: HTMLSpanElement

  readonly #seeButton: HTMLButtonElement

  readonly #sinceInput: HTMLInputElement

  #to = ''

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#errorLog = getDiv('error_log')
    this.#errorCountLabel = getSpan('error_count')
    this.#periodLabel = getSpan('period')
    this.#sinceInput = getInput('since')
    this.#seeButton = getButton('see')
  }

  public addEventListeners(): void {
    this.#sinceInput.addEventListener('change', () => {
      if (!(
        this.#to !== '' &&
        this.#sinceInput.value !== '' &&
        Temporal.PlainDate.compare(this.#sinceInput.value, this.#to) > 0
      )) {
        return
      }

      this.#sinceInput.value = this.#to
      fireAndForget(
        this.#homey.alert(
          this.#homey.__('settings.errorLog.error', { from: this.#from }),
        ),
      )
    })
    this.#seeButton.addEventListener('click', () => {
      fireAndForget(this.fetchErrorLog())
    })
  }

  /**
   * @alerts Displays fetch errors to the user.
   */
  public async fetchErrorLog(): Promise<void> {
    await withDisablingButton(this.#seeButton.id, async () => {
      try {
        const data = await homeyApiGet<FormattedErrorLog>(
          this.#homey,
          `/logs/errors?${new URLSearchParams({
            from: this.#sinceInput.value,
            offset: '0',
            period: '29',
            to: this.#to,
          } satisfies ErrorLogQueryParams)}`,
        )
        this.#updateErrorLogElements(data)
        this.#appendErrorLogRows(data.errors)
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  #appendErrorLogRows(errors: readonly FormattedErrorDetails[]): void {
    for (const error of errors) {
      this.#errorLogTBody ??= this.#createErrorLogTable(Object.keys(error))
      const row = this.#errorLogTBody.insertRow()
      for (const [key, value] of Object.entries(error)) {
        const cell = row.insertCell()
        // Column semantics carried by a class (not source order) so CSS does
        // not silently break if columns are reordered.
        cell.classList.add(`cell-${key}`)
        cell.textContent = String(value)
      }
    }
  }

  #createErrorLogTable(keys: string[]): HTMLTableSectionElement {
    const table = document.createElement('table')
    table.classList.add('bordered')
    const thead = table.createTHead()
    const row = thead.insertRow()
    for (const key of keys) {
      const th = document.createElement('th')
      th.textContent = this.#homey.__(`settings.errorLog.columns.${key}`)
      row.append(th)
    }
    this.#errorLog.append(table)
    return table.createTBody()
  }

  #getErrorCountText(count: number): string {
    if (count < PLURAL_THRESHOLD) {
      return this.#homey.__(`settings.errorLog.errorCount.${String(count)}`)
    }
    const ending = count % Modulo.base10
    const teen = count % Modulo.base100
    if (
      ending >= slavicPaucal.minEnding &&
      ending <= slavicPaucal.maxEnding &&
      (teen < slavicPaucal.teenMin || teen > slavicPaucal.teenMax)
    ) {
      return this.#homey.__('settings.errorLog.errorCount.234')
    }
    return this.#homey.__('settings.errorLog.errorCount.plural')
  }

  #updateErrorLogElements({
    errors,
    fromDateHuman,
    nextFromDate,
    nextToDate,
  }: FormattedErrorLog): void {
    this.#errorCount += errors.length
    this.#from = fromDateHuman
    this.#to = nextToDate
    this.#errorCountLabel.textContent = `${String(this.#errorCount)} ${this.#getErrorCountText(this.#errorCount)}`
    this.#periodLabel.textContent = this.#homey.__('settings.errorLog.period', {
      from: this.#from,
    })
    this.#sinceInput.value = nextFromDate
  }
}

// ── ZoneSettingsManager ──
class ZoneSettingsManager {
  // Home buildings owning at least one ATW device: a capable building in
  // this set shows the "(air-to-air)" scope qualifier.
  readonly #atwBuildingValues = new Set<string>()

  readonly #frostProtectionDirtyGate: DirtyGate

  readonly #frostProtectionEnabled = getSelect('enabled_frost_protection')

  readonly #frostProtectionMaxTemperature = initProtectionMax(
    'max',
    frostProtectionTemperatureRange,
  )

  readonly #frostProtectionMinTemperature = initProtectionMin(
    'min',
    frostProtectionTemperatureRange,
  )

  readonly #holidayModeDirtyGate: DirtyGate

  readonly #holidayModeEnabled = getSelect('enabled_holiday_mode')

  readonly #holidayModeEndDate = getInput('end_date')

  readonly #holidayModeStartDate = getInput('start_date')

  readonly #homey: Homey

  // Option values (devices and buildings) eligible for the Home-only
  // overheat panel: Home ATA devices and buildings owning at least one.
  readonly #overheatCapableValues = new Set<string>()

  readonly #overheatPanel = getFieldset('overheat_protection_panel')

  readonly #overheatProtectionDirtyGate: DirtyGate

  readonly #overheatProtectionEnabled = getSelect('enabled_overheat_protection')

  readonly #overheatProtectionMaxTemperature = initProtectionMax(
    'overheat_max',
    overheatProtectionTemperatureRange,
  )

  readonly #overheatProtectionMinTemperature = initProtectionMin(
    'overheat_min',
    overheatProtectionTemperatureRange,
  )

  readonly #overheatScope = getSpan('overheat_protection_scope')

  readonly #zone = getSelect('zones')

  #zoneMapping: Partial<Record<string, MixableZoneSettings>> = {}

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#frostProtectionDirtyGate = createValuesGate('frost_protection', [
      this.#frostProtectionEnabled,
      this.#frostProtectionMinTemperature,
      this.#frostProtectionMaxTemperature,
    ])
    this.#holidayModeDirtyGate = createValuesGate('holiday_mode', [
      this.#holidayModeEnabled,
      this.#holidayModeStartDate,
      this.#holidayModeEndDate,
    ])
    this.#overheatProtectionDirtyGate = createValuesGate(
      'overheat_protection',
      [
        this.#overheatProtectionEnabled,
        this.#overheatProtectionMinTemperature,
        this.#overheatProtectionMaxTemperature,
      ],
    )
  }

  public addEventListeners(): void {
    this.#zone.addEventListener('change', () => {
      this.#refreshOverheatVisibility()
      fireAndForget(this.fetchZoneSettings())
    })
    this.#addHolidayModeEventListeners()
    this.#addFrostProtectionEventListeners()
    this.#addOverheatProtectionEventListeners()
    // Registered last so a section's dirty recompute runs after any
    // cascade handler (a date edit toggling enabled, enabled clearing the
    // dates): the recompute serializes the whole section, capturing those.
    this.#addDirtyRecomputeListeners()
    // Baseline before the first (fire-and-forget) load lands, so Apply
    // starts pristine (disabled) instead of spuriously enabled.
    this.#frostProtectionDirtyGate.markSaved()
    this.#holidayModeDirtyGate.markSaved()
    this.#overheatProtectionDirtyGate.markSaved()
  }

  /**
   * @silent Falls back to default values on error.
   */
  public displayFrostProtectionData(): void {
    const data = this.#zoneMapping[this.#zone.value]
    if (data !== undefined) {
      const { isEnabled = false, max, min } = data.frost_protection ?? {}
      // `null` (a Home building's devices disagree) reads as blank; a plain
      // `undefined` (a device with no frost config) reads as "No".
      this.#frostProtectionEnabled.value =
        isEnabled === null ? '' : String(isEnabled)
      this.#frostProtectionMinTemperature.value = String(min ?? '')
      this.#frostProtectionMaxTemperature.value = String(max ?? '')
    }
    // Populating the panel re-baselines it: the freshly loaded (or saved)
    // values become the pristine state, so Apply drops back to disabled.
    this.#frostProtectionDirtyGate.markSaved()
  }

  public displayHolidayModeData(): void {
    const data = this.#zoneMapping[this.#zone.value]
    if (data !== undefined) {
      const { endDate, isEnabled = false, startDate } = data.holiday_mode ?? {}
      // `null` enabled (mixed across a building) reads as blank; dates show
      // only when the window is definitely on and itself not mixed.
      this.#holidayModeEnabled.value =
        isEnabled === null ? '' : String(isEnabled)
      this.#holidayModeStartDate.value =
        isEnabled === true ? (startDate ?? '') : ''
      this.#holidayModeEndDate.value = isEnabled === true ? (endDate ?? '') : ''
    }
    // Populating the panel re-baselines it: the freshly loaded (or saved)
    // values become the pristine state, so Apply drops back to disabled.
    this.#holidayModeDirtyGate.markSaved()
  }

  public displayOverheatProtectionData(): void {
    const data = this.#zoneMapping[this.#zone.value]
    if (data !== undefined) {
      const { isEnabled = false, max, min } = data.overheat_protection ?? {}
      // `null` (a Home building's ATA devices disagree) reads as blank; a
      // plain `undefined` (no overheat config) reads as "No".
      this.#overheatProtectionEnabled.value =
        isEnabled === null ? '' : String(isEnabled)
      this.#overheatProtectionMinTemperature.value = String(min ?? '')
      this.#overheatProtectionMaxTemperature.value = String(max ?? '')
    }
    // Populating the panel re-baselines it: the freshly loaded (or saved)
    // values become the pristine state, so Apply drops back to disabled.
    this.#overheatProtectionDirtyGate.markSaved()
  }

  /**
   * @silent Falls back to default values on error.
   */
  public async fetchFrostProtectionData(): Promise<void> {
    await this.#fetchZoneSetting({
      id: 'frost_protection',
      path: 'frost-protection',
      display: () => {
        this.displayFrostProtectionData()
      },
    })
  }

  /**
   * @silent Falls back to default values on error.
   */
  public async fetchHolidayModeData(): Promise<void> {
    await this.#fetchZoneSetting({
      id: 'holiday_mode',
      path: 'holiday-mode',
      display: () => {
        this.displayHolidayModeData()
      },
    })
  }

  /**
   * @silent Falls back to default values on error.
   */
  public async fetchOverheatProtectionData(): Promise<void> {
    await this.#fetchZoneSetting({
      id: 'overheat_protection',
      path: 'overheat-protection',
      display: () => {
        this.displayOverheatProtectionData()
      },
    })
  }

  public async fetchZoneSettings(): Promise<void> {
    await this.fetchFrostProtectionData()
    await this.fetchHolidayModeData()
    // Home-only panel: skip the fetch entirely for targets that cannot
    // carry the feature (Classic zones, ATW devices).
    if (this.#overheatCapableValues.has(this.#zone.value)) {
      await this.fetchOverheatProtectionData()
    }
  }

  public populateZoneOptions(zones: PickerZone[]): void {
    this.#registerOverheatZones(zones)
    for (const zone of zones) {
      const { id, level, model, name } = zone
      createOption(this.#zone, {
        id: getZoneId(id, model),
        label: getZoneName(name, level),
      })
      this.populateZoneOptions(getSubzones(zone))
    }
  }

  /**
   * @alerts Displays save errors to the user.
   */
  public async setFrostProtectionData({
    isEnabled,
    max,
    min,
  }: ProtectionUpdate): Promise<void> {
    await this.#putZoneSetting(
      {
        id: 'frost_protection',
        path: 'frost-protection',
        display: () => {
          this.displayFrostProtectionData()
        },
      },
      { isEnabled, max, min } satisfies ProtectionUpdate,
      { frost_protection: { isEnabled, max, min } },
    )
  }

  /**
   * @alerts Displays save errors to the user.
   */
  public async setHolidayModeData(update: HolidayModeUpdate): Promise<void> {
    const { endDate, isEnabled, startDate } = update
    await this.#putZoneSetting(
      {
        id: 'holiday_mode',
        path: 'holiday-mode',
        display: () => {
          this.displayHolidayModeData()
        },
      },
      update,
      {
        holiday_mode: {
          endDate: isEnabled ? endDate : null,
          isEnabled,
          startDate: isEnabled ? startDate : null,
        },
      },
    )
  }

  /**
   * @alerts Displays save errors to the user.
   */
  public async setOverheatProtectionData({
    isEnabled,
    max,
    min,
  }: {
    isEnabled: boolean
    max: number
    min: number
  }): Promise<void> {
    await this.#putZoneSetting(
      {
        id: 'overheat_protection',
        path: 'overheat-protection',
        display: () => {
          this.displayOverheatProtectionData()
        },
      },
      { isEnabled, max, min },
      { overheat_protection: { isEnabled, max, min } },
    )
  }

  #addDateChangeListener(
    primaryElement: HTMLInputElement,
    otherElement: HTMLInputElement,
  ): void {
    primaryElement.addEventListener('change', () => {
      if (
        primaryElement.value !== '' &&
        this.#holidayModeEnabled.value === 'false'
      ) {
        this.#holidayModeEnabled.value = 'true'
        return
      }
      if (
        primaryElement.value === '' &&
        otherElement.value === '' &&
        this.#holidayModeEnabled.value === 'true'
      ) {
        this.#holidayModeEnabled.value = 'false'
      }
    })
  }

  #addDirtyRecomputeListeners(): void {
    this.#frostProtectionDirtyGate.wire([
      this.#frostProtectionEnabled,
      this.#frostProtectionMinTemperature,
      this.#frostProtectionMaxTemperature,
    ])
    this.#holidayModeDirtyGate.wire([
      this.#holidayModeEnabled,
      this.#holidayModeStartDate,
      this.#holidayModeEndDate,
    ])
    this.#overheatProtectionDirtyGate.wire([
      this.#overheatProtectionEnabled,
      this.#overheatProtectionMinTemperature,
      this.#overheatProtectionMaxTemperature,
    ])
  }

  #addFrostProtectionEventListeners(): void {
    for (const element of [
      this.#frostProtectionMinTemperature,
      this.#frostProtectionMaxTemperature,
    ]) {
      element.addEventListener('change', () => {
        if (
          element.value !== '' &&
          this.#frostProtectionEnabled.value === 'false'
        ) {
          this.#frostProtectionEnabled.value = 'true'
        }
      })
    }
    getButton('refresh_frost_protection').addEventListener('click', () => {
      this.displayFrostProtectionData()
    })
    getButton('apply_frost_protection').addEventListener('click', () => {
      if (!this.#requireEnabledChosen(this.#frostProtectionEnabled)) {
        return
      }
      try {
        const { max, min } = this.#getMinAndMax(
          this.#frostProtectionMinTemperature,
          this.#frostProtectionMaxTemperature,
        )
        fireAndForget(
          this.setFrostProtectionData({
            isEnabled: this.#frostProtectionEnabled.value === 'true',
            max,
            min,
          }),
        )
      } catch (error) {
        fireAndForget(this.#homey.alert(getErrorMessage(error)))
      }
    })
  }

  #addHolidayModeEventListeners(): void {
    this.#holidayModeEnabled.addEventListener('change', () => {
      if (this.#holidayModeEnabled.value !== 'false') {
        return
      }

      this.#holidayModeStartDate.value = ''
      this.#holidayModeEndDate.value = ''
    })
    this.#addDateChangeListener(
      this.#holidayModeStartDate,
      this.#holidayModeEndDate,
    )
    this.#addDateChangeListener(
      this.#holidayModeEndDate,
      this.#holidayModeStartDate,
    )
    getButton('refresh_holiday_mode').addEventListener('click', () => {
      this.displayHolidayModeData()
    })
    getButton('apply_holiday_mode').addEventListener('click', () => {
      const update = this.#readHolidayModeForm()
      if (update !== null) {
        fireAndForget(this.setHolidayModeData(update))
      }
    })
  }

  #addOverheatProtectionEventListeners(): void {
    getButton('refresh_overheat_protection').addEventListener('click', () => {
      this.displayOverheatProtectionData()
    })
    getButton('apply_overheat_protection').addEventListener('click', () => {
      if (!this.#requireEnabledChosen(this.#overheatProtectionEnabled)) {
        return
      }
      try {
        const { max, min } = this.#getMinAndMax(
          this.#overheatProtectionMinTemperature,
          this.#overheatProtectionMaxTemperature,
        )
        fireAndForget(
          this.setOverheatProtectionData({
            isEnabled: this.#overheatProtectionEnabled.value === 'true',
            max,
            min,
          }),
        )
      } catch (error) {
        fireAndForget(this.#homey.alert(getErrorMessage(error)))
      }
    })
  }

  // GET one zone-setting panel: refresh the cached zone mapping and
  // the panel, silent on failure (the UI falls back to default values).
  async #fetchZoneSetting({
    display,
    id,
    path,
  }: ZoneSettingDescriptor): Promise<void> {
    await this.#gateFor(id).runBusy(async () => {
      try {
        this.#updateZoneMapping(await this.#getZoneSettingData(id, path))
        display()
      } catch {
        // Non-critical: UI falls back to default values
      }
    })
  }

  #gateFor(id: ZoneSettingDescriptor['id']): DirtyGate {
    if (id === 'frost_protection') {
      return this.#frostProtectionDirtyGate
    }
    return id === 'holiday_mode'
      ? this.#holidayModeDirtyGate
      : this.#overheatProtectionDirtyGate
  }

  #getMinAndMax(
    minElement: HTMLInputElement,
    maxElement: HTMLInputElement,
  ): { max: number; min: number } {
    const errors: string[] = []
    let [min = null, max = null] = [minElement, maxElement].map((element) => {
      try {
        return parseNumericInput(this.#homey, element)
      } catch (error) {
        errors.push(getErrorMessage(error))
        return null
      }
    })
    if (min === null || max === null || errors.length > 0) {
      const message = errors.join('\n')
      throw new Error(message === '' ? 'Unknown error' : message)
    }
    if (max < min) {
      ;[min, max] = [max, min]
    }
    return { max: Math.max(max, min + PROTECTION_TEMPERATURE_GAP), min }
  }

  // Read one panel's settings for the selected target. Every target kind
  // answers the same neutral shape since the cross-dialect contracts, so
  // there is nothing left to translate: a Classic zone, a Home building
  // (aggregated, `null` per field its devices disagree on) and a single
  // Home device all land in the panel's own cache slot. A `null` payload
  // (nothing configured) reads as empty, i.e. default values.
  async #getZoneSettingData(
    id: ZoneSettingDescriptor['id'],
    path: ZoneSettingDescriptor['path'],
  ): Promise<MixableZoneSettings> {
    return {
      [id]: await homeyApiGet<Mixable<ProtectionState> | null>(
        this.#homey,
        `${this.#getZoneSettingsBase()}/settings/${path}`,
      ),
    }
  }

  #getZoneSettingsBase(): string {
    const { value } = this.#zone
    if (isHomeBuildingValue(value)) {
      return `/home/buildings/${getHomeBuildingId(value)}`
    }
    return isHomeDeviceValue(value)
      ? `/home/devices/${getHomeDeviceId(value)}`
      : `/classic/zones/${getZonePath(value)}`
  }

  // PUT one zone-setting panel: refresh the cached zone mapping and
  // the panel, alert success or failure.
  async #putZoneSetting(
    { display, id, path }: ZoneSettingDescriptor,
    query: HolidayModeUpdate | ProtectionUpdate,
    zoneSettings: MixableZoneSettings,
  ): Promise<void> {
    await this.#gateFor(id).runBusy(async () => {
      try {
        await homeyApiPut<unknown>(
          this.#homey,
          `${this.#getZoneSettingsBase()}/settings/${path}`,
          query,
        )
        this.#updateZoneMapping(zoneSettings)
        display()
        await this.#homey.alert(this.#homey.__('settings.success'))
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  // Build the holiday-mode update from the form, alerting and returning
  // `null` on a validation failure (a mixed enabled not chosen, or an
  // enabled window with no end date).
  #readHolidayModeForm(): HolidayModeUpdate | null {
    if (!this.#requireEnabledChosen(this.#holidayModeEnabled)) {
      return null
    }
    const isEnabled = this.#holidayModeEnabled.value === 'true'
    const { value: startDateValue } = this.#holidayModeStartDate
    const endDate =
      this.#holidayModeEndDate.value === ''
        ? undefined
        : this.#holidayModeEndDate.value
    if (isEnabled && endDate === undefined) {
      fireAndForget(
        this.#homey.alert(
          this.#homey.__('settings.holidayMode.endDateMissing'),
        ),
      )
      return null
    }
    // The window defaults its start to now (an empty field); the dates are
    // ignored when disabling.
    const now = Temporal.Now.plainDateTimeISO().toString()
    return {
      endDate: endDate ?? now,
      isEnabled,
      startDate: startDateValue === '' ? now : startDateValue,
    }
  }

  #refreshOverheatVisibility(): void {
    const { value } = this.#zone
    const isCapable = this.#overheatCapableValues.has(value)
    hide(this.#overheatPanel, !isCapable)
    // The bulk write of a mixed building silently skips its ATW devices —
    // the qualifier says so; a pure-ATA building (or a device) needs none.
    this.#overheatScope.hidden =
      !isCapable || !this.#atwBuildingValues.has(value)
  }

  #registerOverheatZones(zones: readonly PickerZone[]): void {
    const { atwBuildings, capable } = collectOverheatZoneValues(zones)
    for (const value of capable) {
      this.#overheatCapableValues.add(value)
    }
    for (const value of atwBuildings) {
      this.#atwBuildingValues.add(value)
    }
    this.#refreshOverheatVisibility()
  }

  // A blank enabled select means a Home building's devices disagree
  // ("mixed") and the user has not chosen: applying would silently write a
  // single value (off) to them all, so require an explicit choice first.
  #requireEnabledChosen(select: HTMLSelectElement): boolean {
    if (select.value !== '') {
      return true
    }
    fireAndForget(
      this.#homey.alert(this.#homey.__('settings.zones.enabledRequired')),
    )
    return false
  }

  #updateZoneMapping(data: MixableZoneSettings): void {
    const { value } = this.#zone
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
}

// ── SettingsApp ──
class SettingsApp {
  readonly #authManager: AuthManager

  #authState: Record<Api, boolean> = { classic: false, home: false }

  readonly #contentSection: HTMLDivElement

  readonly #deviceSettingsManager: DeviceSettingsManager

  readonly #errorLogManager: ErrorLogManager

  readonly #homey: Homey

  readonly #zoneSettingsManager: ZoneSettingsManager

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#contentSection = getDiv('content')
    this.#deviceSettingsManager = new DeviceSettingsManager(homey)
    this.#zoneSettingsManager = new ZoneSettingsManager(homey)
    this.#errorLogManager = new ErrorLogManager(homey)
    this.#authManager = new AuthManager(
      homey,
      async (api) => this.#onLogin(api),
      (api) => {
        this.#onLogOut(api)
      },
    )
  }

  /**
   * @alerts Falls back to an empty settings object on error.
   */
  static async #fetchHomeySettings(homey: Homey): Promise<HomeySettings> {
    try {
      return await homeyCallback((callback) => {
        homey.get(callback)
      })
    } catch (error) {
      await homey.alert(getErrorMessage(error))
      return {}
    }
  }

  static async #setDocumentLanguage(homey: Homey): Promise<void> {
    try {
      document.documentElement.lang = await homeyApiGet<string>(
        homey,
        '/language',
      )
    } catch {
      // Non-critical: page defaults to browser language
    }
  }

  // `ready()` always fires — an unbounded await here would hold Homey's
  // loading overlay open forever on a single hung or failed call.
  public async init(): Promise<void> {
    // A stale cached page refetches itself once (never-cached address)
    // instead of booting: skip the init — the document is about to be
    // replaced.
    if (await this.#checkFreshness()) {
      return
    }
    // Second trigger of the same handshake: the app pokes open pages at
    // its own (re)boot, when the served hashes may have moved.
    this.#homey.on('webview_hashes_changed', () => {
      fireAndForget(this.#checkFreshness())
    })
    const { error, hasFailed } = await runWebview(this.#homey, this.#run())
    if (hasFailed) {
      // After `ready` (runWebview's finally): an alert raised under the
      // overlay is never seen, and fire-and-forget keeps a rejected alert
      // from bubbling out of `start()` as an unhandled rejection.
      fireAndForget(this.#homey.alert(getErrorMessage(error)))
    }
  }

  #addEventListeners(): void {
    this.#authManager.addEventListeners()
    this.#errorLogManager.addEventListeners()
    this.#zoneSettingsManager.addEventListeners()
    getButton('auto_adjust').addEventListener('click', () => {
      fireAndForget(
        this.#homey.openURL('https://homey.app/a/com.mecloud.extension'),
      )
    })
  }

  // One freshness pass, shared by the boot pull and the app's realtime
  // poke; its breadcrumbs ride the declared boot-error route.
  async #checkFreshness(): Promise<boolean> {
    return ensureFreshWebview(
      'settings',
      async () => homeyApiGet(this.#homey, '/webview-hashes'),
      (message) => {
        this.#homey.api(
          'POST',
          '/boot-error',
          { message, name: 'WebviewFreshness' },
          () => {
            // A missed freshness breadcrumb is acceptable.
          },
        )
      },
    )
  }

  async #ensureDevicesForApi(api: Api): Promise<void> {
    if (api === 'classic') {
      await this.#fetchClassicBuildings()
    } else if (this.#hasHomeDevices()) {
      await this.#fetchHomeTargets()
    } else {
      throw new NoDeviceError(this.#homey)
    }
  }

  async #fetchClassicBuildings(): Promise<void> {
    const buildings = await homeyApiGet<Classic.BuildingZone[]>(
      this.#homey,
      '/classic/buildings',
    )
    if (buildings.length === 0) {
      throw new NoClassicDeviceError(this.#homey)
    }
    this.#zoneSettingsManager.populateZoneOptions(buildings)
    // Not awaited, so it no longer blocks `ready()`: this only fills the
    // zone panel's initial values (silent, default fallback) and the zone
    // selector re-fetches on change anyway. The error log is left to its
    // on-demand "See" button — prefetching it blocked first paint on a
    // MELCloud cloud round-trip (~350 ms on a Homey Pro 2019) and its
    // alert-on-failure would surface unprompted.
    fireAndForget(this.#zoneSettingsManager.fetchZoneSettings())
  }

  // Home targets are appended after any Classic zones.
  async #fetchHomeTargets(): Promise<void> {
    // A tree: each Home building followed by its own devices (indented),
    // both frost/holiday targets.
    const targets = await homeyApiGet<(HomeBuildingZone | HomeDeviceZone)[]>(
      this.#homey,
      '/home/targets',
    )
    this.#zoneSettingsManager.populateZoneOptions(targets)
    // See #fetchClassicBuildings: fills the initial panel values only (the
    // first option, a Classic zone when both accounts are paired).
    fireAndForget(this.#zoneSettingsManager.fetchZoneSettings())
  }

  // A failed probe reads as "not verified" rather than throwing: the
  // caller must not turn an accepted login into a failure alert.
  async #fetchSessionState(api: Api): Promise<boolean> {
    try {
      return await homeyApiGet<boolean>(this.#homey, `/${api}/sessions`)
    } catch {
      return false
    }
  }

  #hasHomeDevices(): boolean {
    return HOME_DRIVER_IDS.some((driverId) =>
      Object.hasOwn(this.#deviceSettingsManager.deviceSettings, driverId),
    )
  }

  async #initCredentialFields({
    homePassword,
    homeUsername,
    password,
    username,
  }: HomeySettings): Promise<void> {
    const driverSettings =
      await this.#deviceSettingsManager.fetchDriverSettings()
    // Homey Settings may return `null` for a cleared key; omit such keys
    // to match `Partial<LoginCredentials>`.
    this.#authManager.createCredentialFields(
      driverSettings,
      {
        classic: {
          ...(typeof password === 'string' && { password }),
          ...(typeof username === 'string' && { username }),
        },
        home: {
          ...(typeof homePassword === 'string' && { password: homePassword }),
          ...(typeof homeUsername === 'string' && { username: homeUsername }),
        },
      },
      API_VALUES.filter((api) => !this.#authState[api]),
    )
  }

  /**
   * @alerts Displays post-login errors to the user.
   */
  async #onLogin(api: Api): Promise<void> {
    // Reflect the server truth instead of assuming success: the login
    // POST resolves even when the post-login device sync fails.
    this.#authState[api] = await this.#fetchSessionState(api)
    if (this.#authState[api]) {
      try {
        await this.#ensureDevicesForApi(api)
      } catch (error) {
        await this.#homey.alert(
          error instanceof NoDeviceError
            ? error.message
            : getErrorMessage(error),
        )
      }
    } else {
      await this.#homey.alert(
        this.#homey.__('settings.authenticate.unverified'),
      )
    }
    this.#refreshVisibility()
  }

  // The app-side logout already killed the session, so mark this API
  // unauthenticated and re-render — the panel reopens on the now-empty
  // account.
  #onLogOut(api: Api): void {
    this.#authState[api] = false
    this.#refreshVisibility()
  }

  #refreshVisibility(): void {
    const { classic: isClassicAuthenticated, home: isHomeAuthenticated } =
      this.#authState
    // Fold only when nothing needs attention: both accounts signed in
    // AND both still hold complete credentials. A reset account (signed
    // out immediately, credentials deleted) keeps the panel open on the
    // empty fields.
    this.#authManager.collapseAuthenticationSection(
      isClassicAuthenticated &&
        isHomeAuthenticated &&
        this.#authManager.getIncompleteApis().length === 0,
    )
    hide(this.#contentSection, !isClassicAuthenticated && !isHomeAuthenticated)
    toggleZoneDeviceSettings(isClassicAuthenticated || isHomeAuthenticated)
  }

  async #run(): Promise<void> {
    const [settings, isClassicAuthenticated, isHomeAuthenticated] =
      await Promise.all([
        SettingsApp.#fetchHomeySettings(this.#homey),
        homeyApiGet<boolean>(this.#homey, '/classic/sessions'),
        homeyApiGet<boolean>(this.#homey, '/home/sessions'),
        SettingsApp.#setDocumentLanguage(this.#homey),
        this.#deviceSettingsManager.fetchDeviceSettings(),
      ])
    this.#authState = {
      classic: isClassicAuthenticated,
      home: isHomeAuthenticated,
    }
    await this.#initCredentialFields(settings)
    this.#addEventListeners()
    await this.#validateInitialAuthStates()
    this.#refreshVisibility()
  }

  async #validateInitialAuthStates(): Promise<void> {
    if (this.#authState.classic) {
      await this.#validateInitialClassicAuth()
    }
    if (this.#authState.home) {
      await this.#validateInitialHomeAuth()
    }
  }

  async #validateInitialClassicAuth(): Promise<void> {
    try {
      await this.#fetchClassicBuildings()
    } catch (error) {
      // No paired Classic device is not an auth failure: the session
      // stays valid, only the device-scoped surfaces have nothing to
      // show (their gates stay pristine on empty data).
      if (!(error instanceof NoClassicDeviceError)) {
        this.#authState.classic = false
      }
    }
  }

  async #validateInitialHomeAuth(): Promise<void> {
    if (this.#hasHomeDevices()) {
      await this.#fetchHomeTargets()
    }
  }
}

/**
 * Page entry point, invoked by the HTML's canonical `onHomeyReady` once
 * the SDK has dispatched (see the inline script in the page head).
 * @param homey - The Homey instance handed to `onHomeyReady`.
 */
export const start = async (homey: Homey): Promise<void> => {
  translateAriaLabels((key) => homey.__(key))
  const app = new SettingsApp(homey)
  await app.init()
}
