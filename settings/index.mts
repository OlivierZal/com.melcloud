import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type Homey from 'homey/lib/HomeySettings'

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
  FormattedErrorDetails,
  FormattedErrorLog,
} from '../types/error-log.mts'

// ── Shared DOM helpers ──

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

const booleanStrings: readonly string[] = [
  'false',
  'true',
] satisfies readonly `${boolean}`[]

const getElement = <T extends HTMLElement>(
  id: string,
  elementConstructor: new () => T,
  elementType: string,
): T => {
  const element = document.querySelector(`#${id}`)
  if (element === null) {
    throw new TypeError(`Element with id \`${id}\` not found`)
  }
  if (!(element instanceof elementConstructor)) {
    throw new TypeError(`Element with id \`${id}\` is not a ${elementType}`)
  }
  return element
}

const getButton = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

const getDiv = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

const getInput = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

const getLabel = (id: string): HTMLLabelElement =>
  getElement(id, HTMLLabelElement, 'label')

const getSelect = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

const createOption = (
  select: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!select.querySelector(`option[value="${id}"]`)) {
    select.append(new Option(label, id))
  }
}

const configureNumericInput = (
  input: HTMLInputElement,
  { max, min }: { max?: number; min?: number },
): void => {
  if (input.type === 'number') {
    input.setAttribute('inputmode', 'numeric')
    if (min !== undefined) {
      input.min = String(min)
    }
    if (max !== undefined) {
      input.max = String(max)
    }
  }
}

// ── Shared zone helpers ──

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`

const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`

// ── Helpers ──

const defaultOnError = (error: unknown): void => {
  // eslint-disable-next-line no-console -- intentional fallback: surfaces otherwise-swallowed rejections in settings dev tools
  console.error(error)
}

const fireAndForget = (
  promise: Promise<unknown>,
  onError: (error: unknown) => void = defaultOnError,
): void => {
  promise.catch(onError)
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}

// Wraps Homey's callback-based settings API in a Promise for async/await usage
const createCallback =
  <T,>(
    resolve: (value: T) => void,
    reject: (reason: Error) => void,
  ): ((error: Error | null, data: T) => void) =>
  (error, data) => {
    if (error) {
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
/* eslint-disable @typescript-eslint/no-magic-numbers -- Slavic grammar constants */
const PLURAL_THRESHOLD = 2
const numberEndsWithTwoThreeFour = new Set([2, 3, 4])
const pluralExceptions = new Set([12, 13, 14])
/* eslint-enable @typescript-eslint/no-magic-numbers */

const frostProtectionTemperatureRange = { max: 16, min: 4 }
const FROST_PROTECTION_TEMPERATURE_GAP = 2

const commonElementTypes = new Set(['checkbox', 'dropdown'])

/** Currently the only Home driver; expand to a readonly array if more are added. */
const HOME_DRIVER_ID = 'home-melcloud'

class NoDeviceError extends Error {
  public override name = 'NoDeviceError'

  public constructor(homey: Homey) {
    super(homey.__('settings.devices.none'))
  }
}

class NoClassicDeviceError extends NoDeviceError {
  public override name = 'NoClassicDeviceError'
}

const disableButton = (id: string, isDisabled = true): void => {
  const element = document.querySelector(`#${id}`)
  if (isDisabled) {
    element?.classList.add('is-disabled')
    return
  }
  element?.classList.remove('is-disabled')
}

const withDisablingButton = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(id)
  await action()
  disableButton(id, false)
}

const withDisablingButtonPair = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(`apply_${id}`)
  disableButton(`refresh_${id}`)
  await action()
  disableButton(`apply_${id}`, false)
  disableButton(`refresh_${id}`, false)
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
  ;({ id: label.htmlFor } = formControl)
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
  if (formControl) {
    const label = createLabel(formControl, title)
    parent.append(shouldWrapWithDiv ? createDiv(label) : label)
  }
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
  placeholder?: string
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
    throw new Error(
      homey.__('settings.intError', {
        max,
        min,
        name: homey.__(
          document.querySelector<HTMLLabelElement>(`label[for="${id}"]`)
            ?.textContent ?? '',
        ),
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
    if (!username || !password) {
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
    // Browser keeps the current selection even if that option is now hidden —
    // advance to the first visible one so submission targets the right API.
    // Note: programmatic `.value` assignment does not fire `change`, so
    // `#syncInputsFromCredentials` below covers what the listener would miss.
    if (!allowed.has(this.#apiSelect.value) && firstAllowed !== '') {
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
    if (loginSetting) {
      const { id, placeholder, title, type } = loginSetting
      const formControl = createInput({ id, placeholder, type })
      appendFormControl(this.#loginSection, { formControl, title })
      return formControl
    }
    return null
  }

  #syncInputsFromCredentials(): void {
    const {
      [this.#currentApi]: { password, username },
    } = this.#credentialsByApi
    if (this.#usernameInput) {
      this.#usernameInput.value = username ?? ''
    }
    if (this.#passwordInput) {
      this.#passwordInput.value = password ?? ''
    }
  }

  #updateOptionVisibility(allowed: ReadonlySet<string>): string {
    let firstAllowed = ''
    for (const option of this.#apiSelect.options) {
      const isAllowed = allowed.has(option.value)
      option.hidden = !isAllowed
      if (isAllowed && firstAllowed === '') {
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

  public get flatDeviceSettings(): Partial<DeviceSetting> {
    return Object.fromEntries(
      Object.entries(
        Object.groupBy(
          Object.values(this.#deviceSettings).flatMap((settings) =>
            Object.entries(settings ?? {}).map(([id, values]) => ({
              id,
              values,
            })),
          ),
          ({ id }) => id,
        ),
      ).map(([id, groupedValues]) => {
        const set = new Set(groupedValues?.map(({ values }) => values))
        return [id, set.size === 1 ? set.values().next().value : null]
      }),
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
    const settings = `settings_${driverId ?? 'common'}`
    const button = getButton(`apply_${settings}`)
    button.addEventListener('click', () => {
      fireAndForget(this.#submitDeviceSettings(elements, driverId))
    })
  }

  #addRefreshSettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${driverId ?? 'common'}`
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
      throw new Error(errors.join('\n') || 'Unknown error')
    }
    return settings
  }

  #createCommonSettingControls(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    for (const { id, title, type, values } of driverSettings.options ?? []) {
      if (
        !this.#settingsCommon.querySelector(
          `select[data-setting-id="${id}"]`,
        ) &&
        commonElementTypes.has(type)
      ) {
        const formControl = createSelect(this.#homey, id, values)
        formControl.dataset.settingId = id
        formControl.dataset.driverId = 'common'
        appendFormControl(this.#settingsCommon, { formControl, title })
        this.#updateCommonSetting(formControl)
      }
    }
    this.#addSettingsEventListeners(
      // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
      Array.from(this.#settingsCommon.querySelectorAll('select')),
    )
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
      if (type === 'checkbox') {
        if (groupLabel !== previousGroupLabel) {
          previousGroupLabel = groupLabel
          createLegend(fieldSet, groupLabel)
        }
        const formControl = createCheckbox(id, driverId)
        appendFormControl(fieldSet, { formControl, title }, false)
        this.#updateDriverSetting(formControl)
      }
    }
  }

  #createDriverSettingSection(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    driverId: string,
  ): void {
    const { [driverId]: driverSetting } = driverSettings
    if (driverSetting) {
      const settingsContainer = document.querySelector(`#settings_${driverId}`)
      if (settingsContainer) {
        const fieldSet = document.createElement('fieldset')
        fieldSet.classList.add('homey-form-checkbox-set')
        this.#createDriverSettingControls(driverSetting, fieldSet)
        settingsContainer.append(fieldSet)
        this.#addSettingsEventListeners(
          // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
          Array.from(fieldSet.querySelectorAll('input')),
          driverId,
        )
        hide(getDiv(`has_devices_${driverId}`), false)
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
    for (const action of ['apply', 'refresh']) {
      disableButton(`${action}_${id}`, isDisabled)
      if (isCommon) {
        for (const driverId of Object.keys(this.#deviceSettings)) {
          disableButton(
            `${action}_${id.replace(/common$/u, driverId)}`,
            isDisabled,
          )
        }
      }
    }
  }

  #parseFormValue(element: HTMLValueElement): Settings[keyof Settings] {
    if (element.value) {
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
    const { [id]: setting } =
      driverId === undefined ?
        this.flatDeviceSettings
      : (this.#deviceSettings[driverId] ?? {})
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
      const {
        flatDeviceSettings: { [settingId]: value },
      } = this
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

  readonly #errorCountLabel: HTMLLabelElement

  readonly #errorLog: HTMLDivElement

  #errorLogTBody: HTMLTableSectionElement | null = null

  #from = ''

  readonly #homey: Homey

  readonly #periodLabel: HTMLLabelElement

  readonly #seeButton: HTMLButtonElement

  readonly #sinceInput: HTMLInputElement

  #to = ''

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#errorLog = getDiv('error_log')
    this.#errorCountLabel = getLabel('error_count')
    this.#periodLabel = getLabel('period')
    this.#sinceInput = getInput('since')
    this.#seeButton = getButton('see')
  }

  public addEventListeners(): void {
    this.#sinceInput.addEventListener('change', () => {
      if (
        this.#to &&
        this.#sinceInput.value &&
        Date.parse(this.#sinceInput.value) > Date.parse(this.#to)
      ) {
        this.#sinceInput.value = this.#to
        fireAndForget(
          this.#homey.alert(
            this.#homey.__('settings.errorLog.error', { from: this.#from }),
          ),
        )
      }
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
            limit: '29',
            offset: '0',
            to: this.#to,
          } satisfies Classic.ErrorLogQuery)}`,
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
      for (const value of Object.values(error)) {
        const cell = row.insertCell()
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
    if (
      numberEndsWithTwoThreeFour.has(count % Modulo.base10) &&
      !pluralExceptions.has(count % Modulo.base100)
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
    const { [this.#zone.value]: data } = this.#zoneMapping
    if (data) {
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
    const { [this.#zone.value]: data } = this.#zoneMapping
    if (data) {
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

  public async populateZoneOptions(zones: Classic.Zone[] = []): Promise<void> {
    if (zones.length > 0) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOption(this.#zone, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        // eslint-disable-next-line no-await-in-loop -- Sequential: parent-child order required for tree rendering
        await this.populateZoneOptions(getSubzones(zone))
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
      try {
        await homeyApiPut<unknown>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/frost-protection`,
          { isEnabled, max, min } satisfies Classic.FrostProtectionQuery,
        )
        this.#updateZoneMapping({
          FPEnabled: isEnabled,
          FPMaxTemperature: max,
          FPMinTemperature: min,
        })
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
      try {
        await homeyApiPut<unknown>(
          this.#homey,
          `/classic/zones/${this.#getZonePath()}/settings/holiday-mode`,
          { from: startDate, to: endDate } satisfies Classic.HolidayModeQuery,
        )
        this.#updateZoneMapping({
          HMEnabled: Boolean(endDate),
          HMEndDate: endDate,
          HMStartDate: startDate,
        })
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
      if (primaryElement.value && this.#holidayModeEnabled.value === 'false') {
        this.#holidayModeEnabled.value = 'true'
        return
      }
      if (
        !primaryElement.value &&
        !otherElement.value &&
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
      if (this.#holidayModeEnabled.value === 'false') {
        this.#holidayModeStartDate.value = ''
        this.#holidayModeEndDate.value = ''
      }
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
      const endDate = this.#holidayModeEndDate.value || undefined
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
          from: this.#holidayModeStartDate.value || undefined,
          to: endDate,
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
    if (errors.length > 0 || min === null || max === null) {
      throw new Error(errors.join('\n') || 'Unknown error')
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
        if (error) {
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

  public async init(): Promise<void> {
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
    this.#homey.ready()
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
    if (Object.keys(this.#deviceSettingsManager.deviceSettings).length === 0) {
      disableButton('apply_settings_common')
      disableButton('refresh_settings_common')
    }
  }

  #disableForError(error: NoDeviceError): void {
    if (error instanceof NoClassicDeviceError) {
      this.#disableClassicButtons()
    }
    this.#disableCommonButtonsIfNoDevices()
  }

  async #fetchClassicBuildings(): Promise<void> {
    const buildings = await homeyApiGet<Classic.BuildingZone[]>(
      this.#homey,
      '/classic/buildings',
    )
    if (buildings.length === 0) {
      throw new NoClassicDeviceError(this.#homey)
    }
    await this.#zoneSettingsManager.populateZoneOptions(buildings)
    await Promise.all([
      this.#errorLogManager.fetchErrorLog(),
      this.#zoneSettingsManager.fetchZoneSettings(),
    ])
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
    return HOME_DRIVER_ID in this.#deviceSettingsManager.deviceSettings
  }

  async #initCredentialFields({
    homePassword,
    homeUsername,
    password,
    username,
  }: HomeySettings): Promise<void> {
    const driverSettings =
      await this.#deviceSettingsManager.fetchDriverSettings()
    // Homey Settings may return `null` for a cleared key; coerce to
    // `undefined` to match `Partial<LoginCredentials>`.
    this.#authManager.createCredentialFields(driverSettings, {
      classic: {
        password: password ?? undefined,
        username: username ?? undefined,
      },
      home: {
        password: homePassword ?? undefined,
        username: homeUsername ?? undefined,
      },
    })
  }

  /** @alerts Displays post-login errors to the user. */
  async #onLogin(api: Api): Promise<void> {
    this.#authState[api] = true
    try {
      if (api === 'classic') {
        await this.#fetchClassicBuildings()
      } else if (!this.#hasHomeDevices()) {
        throw new NoDeviceError(this.#homey)
      }
    } catch (error) {
      if (error instanceof NoDeviceError) {
        this.#disableForError(error)
      }
      await this.#homey.alert(
        error instanceof NoDeviceError ? error.message : getErrorMessage(error),
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

const onHomeyReady = async (homey: Homey): Promise<void> => {
  const app = new SettingsApp(homey)
  await app.init()
}

Object.assign(globalThis, { onHomeyReady })
