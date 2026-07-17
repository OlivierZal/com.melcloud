import type { LoginCredentials } from '@olivierzal/melcloud-api'
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
  ClassicErrorLogQueryParams,
  FormattedErrorDetails,
  FormattedErrorLog,
} from '../types/error-log.mts'
import { getErrorMessage } from '../lib/get-error-message.mts'
import {
  type HTMLValueElement,
  booleanStrings,
  configureNumericInput,
  createOption,
  getButton,
  getDiv,
  getInput,
  getSelect,
  getSpan,
  translateAriaLabels,
} from '../public/dom.mts'
import { fireAndForget, runWebview } from '../public/homey-api.mts'
import { getZoneId, getZoneName } from '../public/zones.mts'

// ── Helpers ──

// Wraps Homey's callback-based settings API in a Promise for async/await usage
const createCallback =
  <T,>(
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
  ): ((error: Error | null, data: T) => void) =>
  (error, data) => {
    if (error !== null) {
      reject(error)
      return
    }
    resolve(data)
  }

const homeyApiGet = async <T,>(homey: Homey, path: string): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('GET', path, createCallback(resolve, reject))
  })

const homeyApiPost = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('POST', path, body, createCallback(resolve, reject))
  })

const homeyApiPut = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('PUT', path, body, createCallback(resolve, reject))
  })

// ── DOM helpers ──

const Modulo = {
  base10: 10,
  base100: 100,
} as const

// Slavic plural rules: numbers ending in 2/3/4 use a special plural
// form, except 12-14 which use the regular plural
const PLURAL_THRESHOLD = 2
const slavicPaucal = { maxEnding: 4, minEnding: 2, teenMax: 14, teenMin: 12 }

const frostProtectionTemperatureRange = { max: 16, min: 4 }
const FROST_PROTECTION_TEMPERATURE_GAP = 2

const commonElementTypes = new Set(['checkbox', 'dropdown'])

/** Currently the only Home driver; expand to a readonly array if more are added. */
const HOME_DRIVER_ID = 'home-melcloud'

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

const withDisablingButtonPair = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(`apply_${id}`)
  disableButton(`refresh_${id}`)
  try {
    await action()
  } finally {
    disableButton(`apply_${id}`, false)
    disableButton(`refresh_${id}`, false)
  }
}

const hide = (element: HTMLDivElement, isHidden = true): void => {
  element.hidden = isHidden
}

const toggleClassicOnlySections = (isVisible: boolean): void => {
  for (const fieldset of document.querySelectorAll<HTMLFieldSetElement>(
    '.classic-only',
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

// Static section ids must be snake_case (html lint), driver ids are not:
// the Home drivers carry a hyphen.
const toSectionId = (driverId: string): string => driverId.replaceAll('-', '_')

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

const initFrostProtectionMin = (): HTMLInputElement => {
  const element = getInput('min')
  element.min = String(frostProtectionTemperatureRange.min)
  element.max = String(
    frostProtectionTemperatureRange.max - FROST_PROTECTION_TEMPERATURE_GAP,
  )
  return element
}

const initFrostProtectionMax = (): HTMLInputElement => {
  const element = getInput('max')
  element.min = String(
    frostProtectionTemperatureRange.min + FROST_PROTECTION_TEMPERATURE_GAP,
  )
  element.max = String(frostProtectionTemperatureRange.max)
  return element
}

const getSubzones = (zone: Classic.Zone): Classic.Zone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

// ── AuthManager ──

class AuthManager {
  readonly #apiOptions: readonly HTMLOptionElement[]

  readonly #apiSelect: HTMLSelectElement

  readonly #authenticateButton: HTMLButtonElement

  readonly #authenticationSection: HTMLDivElement

  #credentialsByApi: Record<Api, Partial<LoginCredentials>> = {
    classic: {},
    home: {},
  }

  readonly #homey: Homey

  readonly #loadPostLoginCallback: (api: Api) => Promise<void>

  readonly #loginSection: HTMLDivElement

  #passwordInput: HTMLInputElement | null = null

  #usernameInput: HTMLInputElement | null = null

  get #currentApi(): Api {
    return this.#apiSelect.value === 'home' ? 'home' : 'classic'
  }

  public constructor(
    homey: Homey,
    loadPostLoginCallback: (api: Api) => Promise<void>,
  ) {
    this.#homey = homey
    this.#loadPostLoginCallback = loadPostLoginCallback
    this.#apiSelect = getSelect('api')
    // Some webview runtimes ignore `hidden` on `<option>`, so unavailable
    // APIs are detached from the DOM. Snapshot the original order to
    // restore them.
    this.#apiOptions = [...this.#apiSelect.options]
    this.#authenticateButton = getButton('authenticate')
    this.#authenticationSection = getDiv('authentication')
    this.#loginSection = getDiv('login')
  }

  public addEventListeners(): void {
    this.#apiSelect.addEventListener('change', () => {
      this.#syncInputsFromCredentials()
    })
    this.#authenticateButton.addEventListener('click', () => {
      fireAndForget(this.login())
    })
  }

  public createCredentialFields(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    credentials: Record<Api, Partial<LoginCredentials>>,
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
    this.#syncInputsFromCredentials()
  }

  public hideAuthenticationSection(isHidden: boolean): void {
    hide(this.#authenticationSection, isHidden)
  }

  /** @alerts Displays authentication errors to the user. */
  public async login(): Promise<void> {
    const api = this.#currentApi
    const username = this.#usernameInput?.value ?? ''
    const password = this.#passwordInput?.value ?? ''
    const failureMessage = this.#homey.__('settings.authenticate.failure')
    if (username === '' || password === '') {
      fireAndForget(this.#homey.alert(failureMessage))
      return
    }
    await withDisablingButton(this.#authenticateButton.id, async () => {
      try {
        await homeyApiPost(this.#homey, `/${api}/sessions`, {
          password,
          username,
        } satisfies LoginCredentials)
        this.#credentialsByApi[api] = { password, username }
        await this.#loadPostLoginCallback(api)
      } catch {
        await this.#homey.alert(failureMessage)
      }
    })
  }

  public setAvailableApis(apis: readonly Api[]): void {
    const allowed = new Set<string>(apis)
    const firstAllowed = this.#updateOptionVisibility(allowed)
    // Programmatic `.value` assignment does not fire `change`, so the
    // `#syncInputsFromCredentials` call below covers what the listener
    // would miss when we redirect to the first available API.
    if (firstAllowed !== '' && !allowed.has(this.#apiSelect.value)) {
      this.#apiSelect.value = firstAllowed
    }
    this.#syncInputsFromCredentials()
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
      appendFormControl(this.#loginSection, { formControl, title })
      return formControl
    }
    return null
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

  #updateOptionVisibility(allowed: ReadonlySet<string>): string {
    let firstAllowed = ''
    this.#apiSelect.replaceChildren()
    for (const option of this.#apiOptions) {
      if (!allowed.has(option.value)) {
        continue
      }

      this.#apiSelect.append(option)
      if (firstAllowed === '') {
        ;({ value: firstAllowed } = option)
      }
    }
    return firstAllowed
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

  readonly #homey: Homey

  readonly #settingsCommon: HTMLDivElement

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#settingsCommon = getDiv('settings_common')
  }

  /** @alerts Displays fetch errors to the user. */
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

  /** @alerts Displays fetch errors to the user. Returns empty fallback on error. */
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

  #addApplySettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${toSectionId(driverId ?? 'common')}`
    const button = getButton(`apply_${settings}`)
    button.addEventListener('click', () => {
      fireAndForget(this.#submitDeviceSettings(elements, driverId))
    })
  }

  #addRefreshSettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${toSectionId(driverId ?? 'common')}`
    const button = getButton(`refresh_${settings}`)
    button.addEventListener('click', () => {
      if (driverId !== undefined) {
        this.#syncDriverSettings(
          elements.filter((element) => element instanceof HTMLInputElement),
        )
        return
      }
      this.#syncCommonSettings(
        elements.filter((element) => element instanceof HTMLSelectElement),
      )
    })
  }

  #addSettingsEventListeners(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    this.#addApplySettingsEventListener(elements, driverId)
    this.#addRefreshSettingsEventListener(elements, driverId)
  }

  #alertNoChanges(elements: HTMLValueElement[], driverId?: string): void {
    if (driverId === undefined) {
      this.#syncCommonSettings(
        elements.filter((element) => element instanceof HTMLSelectElement),
      )
    }
    fireAndForget(this.#homey.alert(this.#homey.__('settings.devices.nothing')))
  }

  async #applyDeviceSettings(body: Settings, driverId?: string): Promise<void> {
    const driverQuery =
      driverId === undefined ? '' : (
        `?${new URLSearchParams({ driverId } satisfies { driverId: string })}`
      )
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
    this.#addSettingsEventListeners([
      ...this.#settingsCommon.querySelectorAll('select'),
    ])
  }

  #createDriverSettingControls(
    driverSetting: DriverSetting[],
    fieldSet: HTMLFieldSetElement,
  ): void {
    let previousGroupLabel = ''
    for (const {
      driverId,
      groupLabel = '',
      id,
      title,
      type,
    } of driverSetting) {
      if (type !== 'checkbox') {
        continue
      }

      if (groupLabel !== previousGroupLabel) {
        previousGroupLabel = groupLabel
        createLegend(fieldSet, groupLabel)
      }
      const formControl = createCheckbox(id, driverId)
      appendFormControl(fieldSet, { formControl, title }, false)
      this.#updateDriverSetting(formControl)
    }
  }

  #createDriverSettingSection(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    driverId: string,
  ): void {
    const driverSetting = driverSettings[driverId]
    if (driverSetting !== undefined) {
      const settingsContainer = document.querySelector(
        `#settings_${toSectionId(driverId)}`,
      )
      if (settingsContainer !== null) {
        const fieldSet = document.createElement('fieldset')
        fieldSet.classList.add('homey-form-checkbox-set')
        this.#createDriverSettingControls(driverSetting, fieldSet)
        settingsContainer.append(fieldSet)
        this.#addSettingsEventListeners(
          [...fieldSet.querySelectorAll('input')],
          driverId,
        )
        hide(getDiv(`has_devices_${toSectionId(driverId)}`), false)
      }
    }
  }

  #createSettingControls(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    this.#createCommonSettingControls(driverSettings)
    for (const driverId of Object.keys(this.#deviceSettings)) {
      this.#createDriverSettingSection(driverSettings, driverId)
    }
  }

  #disableButtons(id: string, isDisabled = true): void {
    const isCommon = id.endsWith('common')
    // Plain suffix swap — a regex would be lowered by the es2020 esbuild
    // target to a runtime RegExp construction on every call.
    const driverIdPrefix = id.slice(0, -'common'.length)
    for (const action of ['apply', 'refresh']) {
      disableButton(`${action}_${id}`, isDisabled)
      if (isCommon) {
        for (const driverId of Object.keys(this.#deviceSettings)) {
          disableButton(`${action}_${driverIdPrefix}${driverId}`, isDisabled)
        }
      }
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
      driverId === undefined ?
        this.flatDeviceSettings
      : (this.#deviceSettings[driverId] ?? {})
    const setting = settings[id]
    return setting === null || value !== setting
  }

  async #submitDeviceSettings(
    elements: HTMLValueElement[],
    driverId?: string,
  ): Promise<void> {
    const body = this.#buildSettingsBody(elements)
    if (Object.keys(body).length === 0) {
      this.#alertNoChanges(elements, driverId)
      return
    }
    const settingsId = `settings_${driverId ?? 'common'}`
    this.#disableButtons(settingsId)
    try {
      await this.#applyDeviceSettings(body, driverId)
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
    } finally {
      this.#disableButtons(settingsId, false)
    }
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

  #updateCommonSetting(element: HTMLSelectElement): void {
    const {
      dataset: { settingId },
    } = element
    if (settingId !== undefined) {
      const value = this.flatDeviceSettings[settingId]
      element.value =
        (
          typeof value === 'boolean' ||
          typeof value === 'number' ||
          typeof value === 'string'
        ) ?
          String(value)
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

  public disable(): void {
    disableButton(this.#seeButton.id)
  }

  /** @alerts Displays fetch errors to the user. */
  public async fetchErrorLog(): Promise<void> {
    await withDisablingButton(this.#seeButton.id, async () => {
      try {
        const data = await homeyApiGet<FormattedErrorLog>(
          this.#homey,
          `/classic/logs/errors?${new URLSearchParams({
            from: this.#sinceInput.value,
            offset: '0',
            period: '29',
            to: this.#to,
          } satisfies ClassicErrorLogQueryParams)}`,
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
  readonly #frostProtectionEnabled: HTMLSelectElement

  readonly #frostProtectionMaxTemperature: HTMLInputElement

  readonly #frostProtectionMinTemperature: HTMLInputElement

  readonly #holidayModeEnabled: HTMLSelectElement

  readonly #holidayModeEndDate: HTMLInputElement

  readonly #holidayModeStartDate: HTMLInputElement

  readonly #homey: Homey

  readonly #zone: HTMLSelectElement

  #zoneMapping: Partial<Record<string, Partial<Classic.ZoneSettings>>> = {}

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#zone = getSelect('zones')
    this.#frostProtectionEnabled = getSelect('enabled_frost_protection')
    this.#holidayModeEnabled = getSelect('enabled_holiday_mode')
    this.#frostProtectionMinTemperature = initFrostProtectionMin()
    this.#frostProtectionMaxTemperature = initFrostProtectionMax()
    this.#holidayModeStartDate = getInput('start_date')
    this.#holidayModeEndDate = getInput('end_date')
  }

  public addEventListeners(): void {
    this.#zone.addEventListener('change', () => {
      fireAndForget(this.fetchZoneSettings())
    })
    this.#addHolidayModeEventListeners()
    this.#addFrostProtectionEventListeners()
  }

  /** @silent Falls back to default values on error. */
  public displayFrostProtectionData(): void {
    const data = this.#zoneMapping[this.#zone.value]
    if (data !== undefined) {
      const {
        FPEnabled: isEnabled,
        FPMaxTemperature: max,
        FPMinTemperature: min,
      } = data
      this.#frostProtectionEnabled.value = String(isEnabled)
      this.#frostProtectionMinTemperature.value = String(min)
      this.#frostProtectionMaxTemperature.value = String(max)
    }
  }

  public displayHolidayModeData(): void {
    const data = this.#zoneMapping[this.#zone.value]
    if (data !== undefined) {
      const {
        HMEnabled: isEnabled = false,
        HMEndDate: endDate,
        HMStartDate: startDate,
      } = data
      this.#holidayModeEnabled.value = String(isEnabled)
      this.#holidayModeStartDate.value = isEnabled ? (startDate ?? '') : ''
      this.#holidayModeEndDate.value = isEnabled ? (endDate ?? '') : ''
    }
  }

  /** @silent Falls back to default values on error. */
  public async fetchFrostProtectionData(): Promise<void> {
    await withDisablingButtonPair('frost_protection', async () => {
      try {
        const data = await homeyApiGet<Classic.FrostProtectionData>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/frost-protection`,
        )
        this.#updateZoneMapping(data)
        this.displayFrostProtectionData()
      } catch {
        // Non-critical: UI falls back to default values
      }
    })
  }

  public async fetchHolidayModeData(): Promise<void> {
    await withDisablingButtonPair('holiday_mode', async () => {
      try {
        const data = await homeyApiGet<Classic.HolidayModeData>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/holiday-mode`,
        )
        this.#updateZoneMapping(data)
        this.displayHolidayModeData()
      } catch {
        // Non-critical: UI falls back to default values
      }
    })
  }

  public async fetchZoneSettings(): Promise<void> {
    await this.fetchFrostProtectionData()
    await this.fetchHolidayModeData()
  }

  public populateZoneOptions(zones: Classic.Zone[] = []): void {
    if (zones.length > 0) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOption(this.#zone, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        this.populateZoneOptions(getSubzones(zone))
      }
    }
  }

  /** @alerts Displays save errors to the user. */
  public async setFrostProtectionData({
    isEnabled,
    max,
    min,
  }: Classic.FrostProtectionQuery): Promise<void> {
    await withDisablingButtonPair('frost_protection', async () => {
      const query = {
        isEnabled,
        max,
        min,
      } satisfies Classic.FrostProtectionQuery
      const zoneSettings: Partial<Classic.ZoneSettings> = {
        FPMaxTemperature: max,
        FPMinTemperature: min,
        ...(isEnabled !== undefined && { FPEnabled: isEnabled }),
      }
      try {
        await homeyApiPut<unknown>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/frost-protection`,
          query,
        )
        this.#updateZoneMapping(zoneSettings)
        this.displayFrostProtectionData()
        await this.#homey.alert(this.#homey.__('settings.success'))
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  /** @alerts Displays save errors to the user. */
  public async setHolidayModeData({
    from: startDate,
    to: endDate,
  }: Classic.HolidayModeQuery): Promise<void> {
    await withDisablingButtonPair('holiday_mode', async () => {
      const query = {
        from: startDate,
        to: endDate,
      } satisfies Classic.HolidayModeQuery
      const zoneSettings: Partial<Classic.ZoneSettings> = {
        HMEnabled: Boolean(endDate),
        HMEndDate: endDate ?? null,
        HMStartDate: startDate ?? null,
      }
      try {
        await homeyApiPut<unknown>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/holiday-mode`,
          query,
        )
        this.#updateZoneMapping(zoneSettings)
        this.displayHolidayModeData()
        await this.#homey.alert(this.#homey.__('settings.success'))
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
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

  #addFrostProtectionEventListeners(): void {
    for (const element of [
      this.#frostProtectionMinTemperature,
      this.#frostProtectionMaxTemperature,
    ]) {
      element.addEventListener('change', () => {
        if (element.value === 'false') {
          element.value = 'true'
        }
      })
    }
    getButton('refresh_frost_protection').addEventListener('click', () => {
      this.displayFrostProtectionData()
    })
    getButton('apply_frost_protection').addEventListener('click', () => {
      try {
        const { max, min } = this.#getFPMinAndMax()
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
      const isEnabled = this.#holidayModeEnabled.value === 'true'
      const { value: startDateValue } = this.#holidayModeStartDate
      const { value: endDateValue } = this.#holidayModeEndDate
      const endDate = endDateValue === '' ? undefined : endDateValue
      if (isEnabled && endDate === undefined) {
        fireAndForget(
          this.#homey.alert(
            this.#homey.__('settings.holidayMode.endDateMissing'),
          ),
        )
        return
      }
      fireAndForget(
        this.setHolidayModeData({
          ...(startDateValue !== '' && { from: startDateValue }),
          ...(endDate !== undefined && { to: endDate }),
        }),
      )
    })
  }

  #getFPMinAndMax(): { max: number; min: number } {
    const errors: string[] = []
    let [min = null, max = null] = [
      this.#frostProtectionMinTemperature,
      this.#frostProtectionMaxTemperature,
    ].map((element) => {
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
    return { max: Math.max(max, min + FROST_PROTECTION_TEMPERATURE_GAP), min }
  }

  #getZonePath(): string {
    return this.#zone.value.replace('_', '/')
  }

  #updateZoneMapping(data: Partial<Classic.ZoneSettings>): void {
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
    this.#authManager = new AuthManager(homey, async (api) =>
      this.#onLogin(api),
    )
  }

  static async #fetchHomeySettings(homey: Homey): Promise<HomeySettings> {
    return new Promise((resolve) => {
      homey.get(async (error: Error | null, settings: HomeySettings) => {
        if (error !== null) {
          await homey.alert(error.message)
          resolve({})
          return
        }
        resolve(settings)
      })
    })
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
  // loading overlay open forever on a single hung or failed call. The
  // failure alert waits until after `ready()`: an alert raised while the
  // overlay is still up never gets seen.
  public async init(): Promise<void> {
    const { error, hasFailed } = await runWebview(this.#homey, this.#run())
    if (hasFailed) {
      // After `ready` (runWebview's finally): an alert raised under the
      // overlay is never seen, and fire-and-forget keeps this non-throwing
      // so a rejected alert cannot trip the HTML loader's catch.
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

  #disableClassicButtons(): void {
    this.#errorLogManager.disable()
    for (const id of ['frost_protection', 'holiday_mode']) {
      disableButton(`apply_${id}`)
      disableButton(`refresh_${id}`)
    }
  }

  #disableCommonButtonsIfNoDevices(): void {
    if (Object.keys(this.#deviceSettingsManager.deviceSettings).length > 0) {
      return
    }

    disableButton('apply_settings_common')
    disableButton('refresh_settings_common')
  }

  #disableForError(error: NoDeviceError): void {
    if (error instanceof NoClassicDeviceError) {
      this.#disableClassicButtons()
    }
    this.#disableCommonButtonsIfNoDevices()
  }

  async #ensureDevicesForApi(api: Api): Promise<void> {
    if (api === 'classic') {
      await this.#fetchClassicBuildings()
    } else if (!this.#hasHomeDevices()) {
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

  // A failed probe reads as "not verified" rather than throwing: the
  // caller must not turn an accepted login into a failure alert.
  async #fetchSessionState(api: Api): Promise<boolean> {
    try {
      return await homeyApiGet<boolean>(this.#homey, `/${api}/sessions`)
    } catch {
      return false
    }
  }

  #getUnauthenticatedApis(): Api[] {
    const { classic: isClassicAuthenticated, home: isHomeAuthenticated } =
      this.#authState
    const apis: Api[] = []
    if (!isClassicAuthenticated) {
      apis.push('classic')
    }
    if (!isHomeAuthenticated) {
      apis.push('home')
    }
    return apis
  }

  #hasHomeDevices(): boolean {
    return Object.hasOwn(
      this.#deviceSettingsManager.deviceSettings,
      HOME_DRIVER_ID,
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
    this.#authManager.createCredentialFields(driverSettings, {
      classic: {
        ...(typeof password === 'string' && { password }),
        ...(typeof username === 'string' && { username }),
      },
      home: {
        ...(typeof homePassword === 'string' && { password: homePassword }),
        ...(typeof homeUsername === 'string' && { username: homeUsername }),
      },
    })
  }

  /** @alerts Displays post-login errors to the user. */
  async #onLogin(api: Api): Promise<void> {
    // Reflect the server truth instead of assuming success: the login
    // POST resolves even when the post-login device sync fails, and a
    // hardcoded `true` here hid the credentials frame for the session
    // only to bring it back on the next page open.
    this.#authState[api] = await this.#fetchSessionState(api)
    if (this.#authState[api]) {
      try {
        await this.#ensureDevicesForApi(api)
      } catch (error) {
        if (error instanceof NoDeviceError) {
          this.#disableForError(error)
        }
        await this.#homey.alert(
          error instanceof NoDeviceError ?
            error.message
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

  #refreshVisibility(): void {
    const { classic: isClassicAuthenticated, home: isHomeAuthenticated } =
      this.#authState
    this.#authManager.hideAuthenticationSection(
      isClassicAuthenticated && isHomeAuthenticated,
    )
    hide(this.#contentSection, !isClassicAuthenticated && !isHomeAuthenticated)
    toggleClassicOnlySections(isClassicAuthenticated)
    this.#authManager.setAvailableApis(this.#getUnauthenticatedApis())
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
    if (this.#authState.home && !this.#hasHomeDevices()) {
      this.#disableForError(new NoDeviceError(this.#homey))
    }
  }

  async #validateInitialClassicAuth(): Promise<void> {
    try {
      await this.#fetchClassicBuildings()
    } catch (error) {
      if (error instanceof NoClassicDeviceError) {
        this.#disableForError(error)
      } else {
        this.#authState.classic = false
      }
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
