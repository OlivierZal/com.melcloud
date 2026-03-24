import type {
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionQuery,
  HolidayModeData,
  HolidayModeQuery,
  LoginCredentials,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type {
  BuildingZone,
  DeviceSetting,
  DeviceSettings,
  DriverSetting,
  HomeySettings,
  LoginDriverSetting,
  Settings,
  ValueOf,
  Zone,
} from '../types/index.mts'

// ── Shared DOM helpers ──

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

const booleanStrings: string[] = ['false', 'true'] satisfies `${boolean}`[]

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

const getButtonElement = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

const getDivElement = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

const getInputElement = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

const getLabelElement = (id: string): HTMLLabelElement =>
  getElement(id, HTMLLabelElement, 'label')

const getSelectElement = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!selectElement.querySelector(`option[value="${id}"]`)) {
    selectElement.append(new Option(label, id))
  }
}

const handleNumericInputElement = (
  inputElement: HTMLInputElement,
  { max, min }: { max?: number; min?: number },
): void => {
  if (inputElement.type === 'number') {
    inputElement.setAttribute('inputmode', 'numeric')
    if (min !== undefined) {
      inputElement.min = String(min)
    }
    if (max !== undefined) {
      inputElement.max = String(max)
    }
  }
}

// ── Shared zone helpers ──

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`

const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`

// ── API helpers ──

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

// Wraps Homey's callback-based settings API in a Promise for async/await usage
const homeyApiGet = async <T,>(homey: Homey, path: string): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('GET', path, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })

const homeyApiPut = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('PUT', path, body, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })

const homeyApiPost = async <T,>(
  homey: Homey,
  path: string,
  body: unknown,
): Promise<T> =>
  new Promise((resolve, reject) => {
    homey.api('POST', path, body, (error: Error | null, data: T) => {
      if (error) {
        reject(error)
      } else {
        resolve(data)
      }
    })
  })

// ── DOM helpers ──

const Modulo = {
  base10: 10,
  base100: 100,
} as const

const INITIAL_ERROR_COUNT = 0

const SIZE_ONE = 1

/*
 * Slavic language pluralization rules: numbers ending in 2-4 use a special
 * form, except 12-14 which use the regular plural
 */
const NUMBER_ENDS_WITH_TWO = 2
const NUMBER_ENDS_WITH_THREE = 3
const NUMBER_ENDS_WITH_FOUR = 4
const numberEndsWithTwoThreeFour = new Set([
  NUMBER_ENDS_WITH_FOUR,
  NUMBER_ENDS_WITH_THREE,
  NUMBER_ENDS_WITH_TWO,
])

const PLURAL_THRESHOLD = 2
const PLURAL_EXCEPTION_TWELVE = 12
const PLURAL_EXCEPTION_THIRTEEN = 13
const PLURAL_EXCEPTION_FOURTEEN = 14
const pluralExceptions = new Set([
  PLURAL_EXCEPTION_FOURTEEN,
  PLURAL_EXCEPTION_THIRTEEN,
  PLURAL_EXCEPTION_TWELVE,
])

const frostProtectionTemperatureRange = { max: 16, min: 4 }
const FROST_PROTECTION_TEMPERATURE_GAP = 2

const commonElementTypes = new Set(['checkbox', 'dropdown'])
const commonElementValueTypes = new Set(['boolean', 'number', 'string'])

class NoDeviceError extends Error {
  public override name = 'NoDeviceError'

  public constructor(homey: Homey) {
    super(homey.__('settings.devices.none'))
  }
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

const hide = (element: HTMLDivElement, isHidden = true): void => {
  element.hidden = isHidden
}

const addTextToCheckbox = (
  labelElement: HTMLLabelElement,
  checkboxElement: HTMLInputElement,
  text: string,
): void => {
  const checkmarkSpanElement = document.createElement('span')
  checkmarkSpanElement.classList.add('homey-form-checkbox-checkmark')
  const textSpanElement = document.createElement('span')
  textSpanElement.classList.add('homey-form-checkbox-text')
  textSpanElement.textContent = text
  labelElement.append(checkboxElement, checkmarkSpanElement, textSpanElement)
}

const createLabelElement = (
  valueElement: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const isCheckbox = valueElement.type === 'checkbox'
  const labelElement = document.createElement('label')
  labelElement.classList.add(
    isCheckbox ? 'homey-form-checkbox' : 'homey-form-label',
  )
  ;({ id: labelElement.htmlFor } = valueElement)
  if (isCheckbox) {
    addTextToCheckbox(labelElement, valueElement, text)
  } else {
    labelElement.textContent = text
    labelElement.append(valueElement)
  }
  return labelElement
}

const createDivElement = (labelElement: HTMLLabelElement): HTMLDivElement => {
  const divElement = document.createElement('div')
  divElement.classList.add('homey-form-group')
  divElement.append(labelElement)
  return divElement
}

const createValueElement = (
  parentElement: HTMLElement,
  {
    title,
    valueElement,
  }: { title: string; valueElement: HTMLValueElement | null },
  shouldWrapWithDiv = true,
): void => {
  if (valueElement) {
    const labelElement = createLabelElement(valueElement, title)
    parentElement.append(
      shouldWrapWithDiv ? createDivElement(labelElement) : labelElement,
    )
  }
}

const createInputElement = ({
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
  const inputElement = document.createElement('input')
  inputElement.classList.add('homey-form-input')
  inputElement.id = id
  inputElement.value = value ?? ''
  inputElement.type = type
  handleNumericInputElement(inputElement, { max, min })
  if (placeholder !== undefined) {
    inputElement.placeholder = placeholder
  }
  return inputElement
}

const createLegendElement = (
  fieldSetElement: HTMLFieldSetElement,
  text?: string,
): void => {
  const legendElement = document.createElement('legend')
  legendElement.classList.add('homey-form-checkbox-set-title')
  if (text !== undefined) {
    legendElement.textContent = text
  }
  fieldSetElement.append(legendElement)
}

const createCheckboxElement = (
  id: string,
  driverId: string,
): HTMLInputElement => {
  const checkboxElement = document.createElement('input')
  checkboxElement.classList.add('homey-form-checkbox-input')
  checkboxElement.type = 'checkbox'
  checkboxElement.id = `${id}__settings_${driverId}`
  return checkboxElement
}

const createSelectElement = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = id
  for (const option of [
    { id: '', label: '' },
    ...(values ??
      booleanStrings.map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ]) {
    createOptionElement(selectElement, option)
  }
  return selectElement
}

const int = (
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

const initFrostProtectionMinElement = (): HTMLInputElement => {
  const element = getInputElement('min')
  element.min = String(frostProtectionTemperatureRange.min)
  element.max = String(
    frostProtectionTemperatureRange.max - FROST_PROTECTION_TEMPERATURE_GAP,
  )
  return element
}

const initFrostProtectionMaxElement = (): HTMLInputElement => {
  const element = getInputElement('max')
  element.min = String(
    frostProtectionTemperatureRange.min + FROST_PROTECTION_TEMPERATURE_GAP,
  )
  element.max = String(frostProtectionTemperatureRange.max)
  return element
}

const getSubzones = (zone: Zone): Zone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

// ── AuthManager ──

class AuthManager {
  readonly #authenticatedElement: HTMLDivElement

  readonly #authenticateElement: HTMLButtonElement

  readonly #authenticatingElement: HTMLDivElement

  readonly #homey: Homey

  readonly #loadPostLoginCallback: () => Promise<void>

  readonly #loginElement: HTMLDivElement

  #passwordElement: HTMLInputElement | null = null

  #usernameElement: HTMLInputElement | null = null

  public constructor(homey: Homey, loadPostLoginCallback: () => Promise<void>) {
    this.#homey = homey
    this.#loadPostLoginCallback = loadPostLoginCallback
    this.#authenticateElement = getButtonElement('authenticate')
    this.#authenticatedElement = getDivElement('authenticated')
    this.#authenticatingElement = getDivElement('authenticating')
    this.#loginElement = getDivElement('login')
  }

  public addEventListeners(): void {
    this.#authenticateElement.addEventListener('click', () => {
      this.login().catch(() => {
        // Errors are handled internally via homey.alert in login
      })
    })
  }

  public generateCredentials(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    {
      password,
      username,
    }: { password?: string | null; username?: string | null },
  ): void {
    this.#usernameElement = this.#generateCredential(
      'username',
      driverSettings,
      username,
    )
    this.#passwordElement = this.#generateCredential(
      'password',
      driverSettings,
      password,
    )
  }

  public async login(): Promise<void> {
    const username = this.#usernameElement?.value ?? ''
    const password = this.#passwordElement?.value ?? ''
    if (!username || !password) {
      this.#homey
        .alert(this.#homey.__('settings.authenticate.failure'))
        .catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      return
    }
    await withDisablingButton(this.#authenticateElement.id, async () => {
      try {
        const isLoggedIn = await homeyApiPost<boolean>(
          this.#homey,
          '/sessions',
          { password, username } satisfies LoginCredentials,
        )
        await (isLoggedIn ?
          this.#loadPostLoginCallback()
        : this.#homey.alert(this.#homey.__('settings.authenticate.failure')))
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  public needsAuthentication(isRequired = true): void {
    hide(this.#authenticatedElement, isRequired)
    hide(this.#authenticatingElement, !isRequired)
  }

  #generateCredential(
    credentialKey: keyof LoginCredentials,
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    value?: string | null,
  ): HTMLInputElement | null {
    const loginSetting = driverSettings['login']?.find(
      (setting): setting is LoginDriverSetting => setting.id === credentialKey,
    )
    if (loginSetting) {
      const { id, placeholder, title, type } = loginSetting
      const valueElement = createInputElement({ id, placeholder, type, value })
      createValueElement(this.#loginElement, { title, valueElement })
      return valueElement
    }
    return null
  }
}

// ── ErrorLogManager ──

class ErrorLogManager {
  readonly #errorCountLabelElement: HTMLLabelElement

  readonly #errorLogElement: HTMLDivElement

  readonly #homey: Homey

  readonly #periodLabelElement: HTMLLabelElement

  readonly #seeElement: HTMLButtonElement

  readonly #sinceElement: HTMLInputElement

  #errorCount = INITIAL_ERROR_COUNT

  #errorLogTBodyElement: HTMLTableSectionElement | null = null

  #from = ''

  #to = ''

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#errorLogElement = getDivElement('error_log')
    this.#errorCountLabelElement = getLabelElement('error_count')
    this.#periodLabelElement = getLabelElement('period')
    this.#sinceElement = getInputElement('since')
    this.#seeElement = getButtonElement('see')
  }

  public get from(): string {
    return this.#from
  }

  public get seeElementId(): string {
    return this.#seeElement.id
  }

  public get sinceElement(): HTMLInputElement {
    return this.#sinceElement
  }

  public get to(): string {
    return this.#to
  }

  public addEventListeners(): void {
    this.#sinceElement.addEventListener('change', () => {
      if (
        this.#to &&
        this.#sinceElement.value &&
        Date.parse(this.#sinceElement.value) > Date.parse(this.#to)
      ) {
        this.#sinceElement.value = this.#to
        this.#homey
          .alert(
            this.#homey.__('settings.errorLog.error', { from: this.#from }),
          )
          .catch(() => {
            // Best-effort UI notification: the alert itself is the error display
          })
      }
    })
    this.#seeElement.addEventListener('click', () => {
      this.fetchErrorLog().catch(() => {
        // Errors are handled internally via homey.alert in fetchErrorLog
      })
    })
  }

  public async fetchErrorLog(): Promise<void> {
    await withDisablingButton(this.#seeElement.id, async () => {
      try {
        const data = await homeyApiGet<ErrorLog>(
          this.#homey,
          `/logs/errors?${new URLSearchParams({
            from: this.#sinceElement.value,
            limit: '29',
            offset: '0',
            to: this.#to,
          } satisfies ErrorLogQuery)}`,
        )
        this.#updateErrorLogElements(data)
        this.#generateErrorLogTableData(data.errors)
      } catch (error) {
        await this.#homey.alert(getErrorMessage(error))
      }
    })
  }

  #generateErrorLogTable(keys: string[]): HTMLTableSectionElement {
    const tableElement = document.createElement('table')
    tableElement.classList.add('bordered')
    const theadElement = tableElement.createTHead()
    const rowElement = theadElement.insertRow()
    for (const key of keys) {
      const thElement = document.createElement('th')
      thElement.textContent = this.#homey.__(`settings.errorLog.columns.${key}`)
      rowElement.append(thElement)
    }
    this.#errorLogElement.append(tableElement)
    return tableElement.createTBody()
  }

  #generateErrorLogTableData(errors: readonly ErrorDetails[]): void {
    for (const error of errors) {
      this.#errorLogTBodyElement ??= this.#generateErrorLogTable(
        Object.keys(error),
      )
      const rowElement = this.#errorLogTBodyElement.insertRow()
      for (const value of Object.values(error)) {
        const cellElement = rowElement.insertCell()
        cellElement.textContent = String(value)
      }
    }
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
  }: ErrorLog): void {
    this.#errorCount += errors.length
    this.#from = fromDateHuman
    this.#to = nextToDate
    this.#errorCountLabelElement.textContent = `${String(this.#errorCount)} ${this.#getErrorCountText(this.#errorCount)}`
    this.#periodLabelElement.textContent = this.#homey.__(
      'settings.errorLog.period',
      { from: this.#from },
    )
    this.#sinceElement.value = nextFromDate
  }
}

// ── DeviceSettingsManager ──

class DeviceSettingsManager {
  readonly #homey: Homey

  readonly #settingsCommonElement: HTMLDivElement

  #deviceSettings: Partial<DeviceSettings> = {}

  #flatDeviceSettings: Partial<DeviceSetting> = {}

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#settingsCommonElement = getDivElement('settings_common')
  }

  public get deviceSettings(): Partial<DeviceSettings> {
    return this.#deviceSettings
  }

  public get flatDeviceSettings(): Partial<DeviceSetting> {
    return this.#flatDeviceSettings
  }

  public disableButtons(id: string, isDisabled = true): void {
    this.#disableButtons(id, isDisabled)
  }

  public async fetchDeviceSettings(): Promise<void> {
    try {
      this.#deviceSettings = await homeyApiGet<DeviceSettings>(
        this.#homey,
        '/settings/devices',
      )
      this.#fetchFlattenDeviceSettings()
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
    }
  }

  public async fetchDriverSettings(): Promise<
    Partial<Record<string, DriverSetting[]>>
  > {
    try {
      const settings = await homeyApiGet<
        Partial<Record<string, DriverSetting[]>>
      >(this.#homey, '/settings/drivers')
      this.#generateSettings(settings)
      return settings
    } catch (error) {
      await this.#homey.alert(getErrorMessage(error))
      return {}
    }
  }

  public async withDisablingButtons(
    id: string,
    action: () => Promise<void>,
  ): Promise<void> {
    this.#disableButtons(id)
    await action()
    this.#disableButtons(id, false)
  }

  #addApplySettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${driverId ?? 'common'}`
    const buttonElement = getButtonElement(`apply_${settings}`)
    buttonElement.addEventListener('click', () => {
      this.#setDeviceSettings(elements, driverId).catch(() => {
        // Errors are handled internally via homey.alert in #setDeviceSettings
      })
    })
  }

  #addRefreshSettingsEventListener(
    elements: HTMLValueElement[],
    driverId?: string,
  ): void {
    const settings = `settings_${driverId ?? 'common'}`
    const buttonElement = getButtonElement(`refresh_${settings}`)
    buttonElement.addEventListener('click', () => {
      if (driverId !== undefined) {
        this.#refreshDriverSettings(
          elements.filter((element) => element instanceof HTMLInputElement),
        )
        return
      }
      this.#refreshCommonSettings(
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
    if (errors.length) {
      throw new Error(errors.join('\n') || 'Unknown error')
    }
    return settings
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

  #fetchFlattenDeviceSettings(): void {
    this.#flatDeviceSettings = Object.fromEntries(
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
        return [id, set.size === SIZE_ONE ? set.values().next().value : null]
      }),
    )
  }

  #generateCommonSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    for (const { id, title, type, values } of driverSettings['options'] ?? []) {
      const settingId = `${id}__settings_common`
      if (
        !this.#settingsCommonElement.querySelector(`select#${settingId}`) &&
        commonElementTypes.has(type)
      ) {
        const valueElement = createSelectElement(this.#homey, settingId, values)
        createValueElement(this.#settingsCommonElement, { title, valueElement })
        this.#updateCommonSetting(valueElement)
      }
    }
    this.#addSettingsEventListeners(
      // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
      Array.from(this.#settingsCommonElement.querySelectorAll('select')),
    )
  }

  #generateDriverSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
    driverId: string,
  ): void {
    const { [driverId]: driverSetting } = driverSettings
    if (driverSetting) {
      const settingsElement = document.querySelector(`#settings_${driverId}`)
      if (settingsElement) {
        const fieldSetElement = document.createElement('fieldset')
        fieldSetElement.classList.add('homey-form-checkbox-set')
        this.#handleDriverSettings(driverSetting, fieldSetElement)
        settingsElement.append(fieldSetElement)
        this.#addSettingsEventListeners(
          // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
          Array.from(fieldSetElement.querySelectorAll('input')),
          driverId,
        )
        hide(getDivElement(`has_devices_${driverId}`), false)
      }
    }
  }

  #generateSettings(
    driverSettings: Partial<Record<string, DriverSetting[]>>,
  ): void {
    this.#generateCommonSettings(driverSettings)
    for (const driverId of Object.keys(this.#deviceSettings)) {
      this.#generateDriverSettings(driverSettings, driverId)
    }
  }

  #handleDriverSettings(
    driverSetting: DriverSetting[],
    fieldSetElement: HTMLFieldSetElement,
  ): void {
    let previousGroupLabel = ''
    for (const { driverId, groupLabel, id, title, type } of driverSetting) {
      if (type === 'checkbox') {
        if (groupLabel !== previousGroupLabel) {
          previousGroupLabel = groupLabel ?? ''
          createLegendElement(fieldSetElement, groupLabel)
        }
        const valueElement = createCheckboxElement(id, driverId)
        createValueElement(fieldSetElement, { title, valueElement }, false)
        this.#updateDriverSetting(valueElement)
      }
    }
  }

  #processValue(element: HTMLValueElement): ValueOf<Settings> {
    if (element.value) {
      if (element.type === 'checkbox') {
        return element.indeterminate ? null : element.checked
      }
      if (
        element.type === 'number' &&
        element.min !== '' &&
        element.max !== ''
      ) {
        return int(this.#homey, element)
      }
      if (booleanStrings.includes(element.value)) {
        return element.value === 'true'
      }
      const numberValue = Number(element.value)
      return Number.isFinite(numberValue) ? numberValue : element.value
    }
    return null
  }

  #refreshCommonSettings(elements: HTMLSelectElement[]): void {
    for (const element of elements) {
      this.#updateCommonSetting(element)
    }
  }

  #refreshDriverSettings(elements: HTMLInputElement[]): void {
    for (const element of elements) {
      this.#updateDriverSetting(element)
    }
  }

  async #setDeviceSettings(
    elements: HTMLValueElement[],
    driverId?: string,
  ): Promise<void> {
    const body = this.#buildSettingsBody(elements)
    if (!Object.keys(body).length) {
      if (driverId === undefined) {
        this.#refreshCommonSettings(
          elements.filter((element) => element instanceof HTMLSelectElement),
        )
      }
      this.#homey
        .alert(this.#homey.__('settings.devices.nothing'))
        .catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      return
    }
    await this.withDisablingButtons(
      `settings_${driverId ?? 'common'}`,
      async () => {
        try {
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
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  #setSetting(settings: Settings, element: HTMLValueElement): void {
    const [id, driverId] = element.id.split('__settings_')
    if (id !== undefined) {
      const value = this.#processValue(element)
      if (
        this.#shouldUpdate(
          id,
          value,
          driverId === 'common' ? undefined : driverId,
        )
      ) {
        settings[id] = value
      }
    }
  }

  #shouldUpdate(
    id: string,
    value: ValueOf<Settings>,
    driverId?: string,
  ): boolean {
    if (value === null) {
      return false
    }
    const setting =
      driverId === undefined ?
        this.#flatDeviceSettings[id]
      : this.#deviceSettings[driverId]?.[id]
    return setting === null || value !== setting
  }

  #updateCommonSetting(element: HTMLSelectElement): void {
    const [id] = element.id.split('__settings_')
    if (id !== undefined) {
      const { [id]: value } = this.#flatDeviceSettings
      element.value =
        commonElementValueTypes.has(typeof value) ? String(value) : ''
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
      if (driverId === undefined) {
        this.#flatDeviceSettings[id] = value
      }
    }
    if (driverId !== undefined) {
      this.#fetchFlattenDeviceSettings()
    }
  }

  #updateDriverSetting(element: HTMLInputElement): void {
    const [id, driverId] = element.id.split('__settings_')
    if (id !== undefined && driverId !== undefined) {
      const isChecked = this.#deviceSettings[driverId]?.[id]
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

// ── ZoneSettingsManager ──

class ZoneSettingsManager {
  readonly #deviceSettingsManager: DeviceSettingsManager

  readonly #frostProtectionEnabledElement: HTMLSelectElement

  readonly #frostProtectionMaxTemperatureElement: HTMLInputElement

  readonly #frostProtectionMinTemperatureElement: HTMLInputElement

  readonly #holidayModeEnabledElement: HTMLSelectElement

  readonly #holidayModeEndDateElement: HTMLInputElement

  readonly #holidayModeStartDateElement: HTMLInputElement

  readonly #homey: Homey

  readonly #zoneElement: HTMLSelectElement

  #zoneMapping: Partial<Record<string, Partial<ZoneSettings>>> = {}

  public constructor(
    homey: Homey,
    deviceSettingsManager: DeviceSettingsManager,
  ) {
    this.#homey = homey
    this.#deviceSettingsManager = deviceSettingsManager
    this.#zoneElement = getSelectElement('zones')
    this.#frostProtectionEnabledElement = getSelectElement(
      'enabled_frost_protection',
    )
    this.#holidayModeEnabledElement = getSelectElement('enabled_holiday_mode')
    this.#frostProtectionMinTemperatureElement = initFrostProtectionMinElement()
    this.#frostProtectionMaxTemperatureElement = initFrostProtectionMaxElement()
    this.#holidayModeStartDateElement = getInputElement('start_date')
    this.#holidayModeEndDateElement = getInputElement('end_date')
  }

  public addEventListeners(): void {
    this.#zoneElement.addEventListener('change', () => {
      this.fetchZoneSettings().catch(() => {
        // Errors are handled internally by fetchFrostProtectionData and fetchHolidayModeData
      })
    })
    this.#addHolidayModeEventListeners()
    this.#addFrostProtectionEventListeners()
  }

  public async fetchFrostProtectionData(): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'frost_protection',
      async () => {
        try {
          const data = await homeyApiGet<FrostProtectionData>(
            this.#homey,
            `/settings/frost_protection/${this.#getZonePath()}`,
          )
          this.#updateZoneMapping(data)
          this.refreshFrostProtectionData()
        } catch {
          // Non-critical: UI falls back to default values
        }
      },
    )
  }

  public async fetchHolidayModeData(): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'holiday_mode',
      async () => {
        try {
          const data = await homeyApiGet<HolidayModeData>(
            this.#homey,
            `/settings/holiday_mode/${this.#getZonePath()}`,
          )
          this.#updateZoneMapping(data)
          this.refreshHolidayModeData()
        } catch {
          // Non-critical: UI falls back to default values
        }
      },
    )
  }

  public async fetchZoneSettings(): Promise<void> {
    await this.fetchFrostProtectionData()
    await this.fetchHolidayModeData()
  }

  public async generateZones(zones: Zone[] = []): Promise<void> {
    if (zones.length) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOptionElement(this.#zoneElement, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        // eslint-disable-next-line no-await-in-loop -- Sequential: parent-child order required for tree rendering
        await this.generateZones(getSubzones(zone))
      }
    }
  }

  public refreshFrostProtectionData(): void {
    const { [this.#zoneElement.value]: data } = this.#zoneMapping
    if (data) {
      const {
        FPEnabled: isEnabled,
        FPMaxTemperature: max,
        FPMinTemperature: min,
      } = data
      this.#frostProtectionEnabledElement.value = String(isEnabled)
      this.#frostProtectionMinTemperatureElement.value = String(min)
      this.#frostProtectionMaxTemperatureElement.value = String(max)
    }
  }

  public refreshHolidayModeData(): void {
    const { [this.#zoneElement.value]: data } = this.#zoneMapping
    if (data) {
      const {
        HMEnabled: isEnabled = false,
        HMEndDate: endDate,
        HMStartDate: startDate,
      } = data
      this.#holidayModeEnabledElement.value = String(isEnabled)
      this.#holidayModeStartDateElement.value =
        isEnabled ? (startDate ?? '') : ''
      this.#holidayModeEndDateElement.value = isEnabled ? (endDate ?? '') : ''
    }
  }

  public async setFrostProtectionData({
    isEnabled,
    max,
    min,
  }: FrostProtectionQuery): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'frost_protection',
      async () => {
        try {
          await homeyApiPut<unknown>(
            this.#homey,
            `/settings/frost_protection/${this.#getZonePath()}`,
            { isEnabled, max, min } satisfies FrostProtectionQuery,
          )
          this.#updateZoneMapping({
            FPEnabled: isEnabled,
            FPMaxTemperature: max,
            FPMinTemperature: min,
          })
          this.refreshFrostProtectionData()
          await this.#homey.alert(this.#homey.__('settings.success'))
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  public async setHolidayModeData({
    from: startDate,
    to: endDate,
  }: HolidayModeQuery): Promise<void> {
    await this.#deviceSettingsManager.withDisablingButtons(
      'holiday_mode',
      async () => {
        try {
          await homeyApiPut<unknown>(
            this.#homey,
            `/settings/holiday_mode/${this.#zoneElement.value.replace('_', '/')}`,
            { from: startDate, to: endDate } satisfies HolidayModeQuery,
          )
          this.#updateZoneMapping({
            HMEnabled: Boolean(endDate),
            HMEndDate: endDate,
            HMStartDate: startDate,
          })
          this.refreshHolidayModeData()
          await this.#homey.alert(this.#homey.__('settings.success'))
        } catch (error) {
          await this.#homey.alert(getErrorMessage(error))
        }
      },
    )
  }

  #addDateChangeListener(
    primaryElement: HTMLInputElement,
    otherElement: HTMLInputElement,
  ): void {
    primaryElement.addEventListener('change', () => {
      if (
        primaryElement.value &&
        this.#holidayModeEnabledElement.value === 'false'
      ) {
        this.#holidayModeEnabledElement.value = 'true'
        return
      }
      if (
        !primaryElement.value &&
        !otherElement.value &&
        this.#holidayModeEnabledElement.value === 'true'
      ) {
        this.#holidayModeEnabledElement.value = 'false'
      }
    })
  }

  #addFrostProtectionEventListeners(): void {
    for (const element of [
      this.#frostProtectionMinTemperatureElement,
      this.#frostProtectionMaxTemperatureElement,
    ]) {
      element.addEventListener('change', () => {
        if (element.value === 'false') {
          element.value = 'true'
        }
      })
    }
    getButtonElement('refresh_frost_protection').addEventListener(
      'click',
      () => {
        this.refreshFrostProtectionData()
      },
    )
    getButtonElement('apply_frost_protection').addEventListener('click', () => {
      try {
        const { max, min } = this.#getFPMinAndMax()
        this.setFrostProtectionData({
          isEnabled: this.#frostProtectionEnabledElement.value === 'true',
          max,
          min,
        }).catch(() => {
          // Errors are handled internally via homey.alert in setFrostProtectionData
        })
      } catch (error) {
        this.#homey.alert(getErrorMessage(error)).catch(() => {
          // Best-effort UI notification: the alert itself is the error display
        })
      }
    })
  }

  #addHolidayModeEventListeners(): void {
    this.#holidayModeEnabledElement.addEventListener('change', () => {
      if (this.#holidayModeEnabledElement.value === 'false') {
        this.#holidayModeStartDateElement.value = ''
        this.#holidayModeEndDateElement.value = ''
      }
    })
    this.#addDateChangeListener(
      this.#holidayModeStartDateElement,
      this.#holidayModeEndDateElement,
    )
    this.#addDateChangeListener(
      this.#holidayModeEndDateElement,
      this.#holidayModeStartDateElement,
    )
    getButtonElement('refresh_holiday_mode').addEventListener('click', () => {
      this.refreshHolidayModeData()
    })
    getButtonElement('apply_holiday_mode').addEventListener('click', () => {
      const isEnabled = this.#holidayModeEnabledElement.value === 'true'
      const endDate = this.#holidayModeEndDateElement.value || undefined
      if (isEnabled && endDate === undefined) {
        this.#homey
          .alert(this.#homey.__('settings.holidayMode.endDateMissing'))
          .catch(() => {
            // Best-effort UI notification: the alert itself is the error display
          })
        return
      }
      this.setHolidayModeData({
        from: this.#holidayModeStartDateElement.value || undefined,
        to: endDate,
      }).catch(() => {
        // Errors are handled internally via homey.alert in setHolidayModeData
      })
    })
  }

  #getFPMinAndMax(): { max: number; min: number } {
    const errors: string[] = []
    let [min = null, max = null] = [
      this.#frostProtectionMinTemperatureElement,
      this.#frostProtectionMaxTemperatureElement,
    ].map((element) => {
      try {
        return int(this.#homey, element)
      } catch (error) {
        errors.push(getErrorMessage(error))
        return null
      }
    })
    if (errors.length || min === null || max === null) {
      throw new Error(errors.join('\n') || 'Unknown error')
    }
    if (max < min) {
      ;[min, max] = [max, min]
    }
    return { max: Math.max(max, min + FROST_PROTECTION_TEMPERATURE_GAP), min }
  }

  #getZonePath(): string {
    return this.#zoneElement.value.replace('_', '/')
  }

  #updateZoneMapping(data: Partial<ZoneSettings>): void {
    const { value } = this.#zoneElement
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
}

// ── SettingsApp ──

class SettingsApp {
  readonly #authManager: AuthManager

  readonly #deviceSettingsManager: DeviceSettingsManager

  readonly #errorLogManager: ErrorLogManager

  readonly #homey: Homey

  readonly #zoneSettingsManager: ZoneSettingsManager

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#deviceSettingsManager = new DeviceSettingsManager(homey)
    this.#zoneSettingsManager = new ZoneSettingsManager(
      homey,
      this.#deviceSettingsManager,
    )
    this.#errorLogManager = new ErrorLogManager(homey)
    this.#authManager = new AuthManager(homey, async () =>
      this.#loadPostLogin(),
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
    const { contextKey, password, username } =
      await SettingsApp.#fetchHomeySettings(this.#homey)
    await SettingsApp.#setDocumentLanguage(this.#homey)
    await this.#deviceSettingsManager.fetchDeviceSettings()
    const driverSettings =
      await this.#deviceSettingsManager.fetchDriverSettings()
    this.#authManager.generateCredentials(driverSettings, {
      password,
      username,
    })
    this.#addEventListeners()
    await this.#load(contextKey)
    this.#homey.ready()
  }

  #addEventListeners(): void {
    this.#authManager.addEventListeners()
    this.#errorLogManager.addEventListeners()
    this.#zoneSettingsManager.addEventListeners()
    getButtonElement('auto_adjust').addEventListener('click', () => {
      this.#homey
        .openURL('https://homey.app/a/com.mecloud.extension')
        .catch(() => {
          // Best-effort navigation: if opening the URL fails, there is nothing more to do
        })
    })
  }

  #disableSettingButtons(): void {
    disableButton(this.#errorLogManager.seeElementId)
    this.#deviceSettingsManager.disableButtons('frost_protection')
    this.#deviceSettingsManager.disableButtons('holiday_mode')
    this.#deviceSettingsManager.disableButtons('settings_common')
  }

  async #fetchBuildings(): Promise<void> {
    const buildings = await homeyApiGet<BuildingZone[]>(
      this.#homey,
      '/buildings',
    ).catch(async (error: unknown) => {
      await this.#homey.alert(getErrorMessage(error))
      throw error
    })
    if (!buildings.length) {
      throw new NoDeviceError(this.#homey)
    }
    await this.#zoneSettingsManager.generateZones(buildings)
    await this.#errorLogManager.fetchErrorLog()
    await this.#zoneSettingsManager.fetchZoneSettings()
  }

  async #load(contextKey?: string | null): Promise<void> {
    if (contextKey !== undefined) {
      try {
        await this.#fetchBuildings()
        this.#authManager.needsAuthentication(false)
        return
      } catch {
        // Session expired or no devices: fall through to login
      }
    }
    this.#authManager.needsAuthentication()
  }

  async #loadPostLogin(): Promise<void> {
    try {
      await this.#fetchBuildings()
    } catch (error) {
      if (error instanceof NoDeviceError) {
        this.#disableSettingButtons()
        await this.#homey.alert(error.message)
      }
    } finally {
      this.#authManager.needsAuthentication(false)
    }
  }
}

const onHomeyReady = async (homey: Homey): Promise<void> => {
  const app = new SettingsApp(homey)
  await app.init()
}

Object.assign(globalThis, { onHomeyReady })
