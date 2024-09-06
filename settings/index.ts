import type {
  FrostProtectionData,
  GroupAtaState,
  HolidayModeData,
  LoginCredentials,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type {
  Building,
  DeviceSetting,
  DeviceSettings,
  DriverCapabilitiesOptions,
  DriverSetting,
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionSettings,
  HolidayModeSettings,
  HomeySettingsUI,
  LoginDriverSetting,
  Settings,
  ValueOf,
} from '../types'

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

class NoDeviceError extends Error {
  public constructor(homey: Homey) {
    super(homey.__('settings.devices.none'))
  }
}

const DAYS_14 = 14

const DIVISOR_10 = 10
const DIVISOR_100 = 100

const MIN_FAN_SPEED = 0
const MAX_FAN_SPEED = 5

const MIN_SET_TEMPERATURE = 10
const MIN_SET_TEMPERATURE_COOLING = 16
const MAX_SET_TEMPERATURE = 31

const MIN_MAPPING = {
  FanSpeed: MIN_FAN_SPEED,
  SetTemperature: MIN_SET_TEMPERATURE,
}
const MAX_MAPPING = {
  FanSpeed: MAX_FAN_SPEED,
  SetTemperature: MAX_SET_TEMPERATURE,
}

const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2
const COOLING_MODES = [MODE_AUTO, MODE_COOL, MODE_DRY]

const MIN_FP_TEMPERATURE_MIN = 4
const MIN_FP_TEMPERATURE_MAX = 14
const MAX_FP_TEMPERATURE_MIN = 6
const MAX_FP_TEMPERATURE_MAX = 16
const GAP_FP_TEMPERATURE = 2

const NUMBER_1 = 1
const NUMBER_2 = 2
const NUMBER_3 = 3
const NUMBER_4 = 4
const NUMBER_12 = 12
const NUMBER_13 = 13
const NUMBER_14 = 14

const pad = (num: number): string => String(num).padStart(NUMBER_2, '0')

const formatDateTimeLocal = (date: Date): string => {
  const year = String(date.getFullYear())
  const month = pad(date.getMonth() + NUMBER_1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

const now = (): string => formatDateTimeLocal(new Date())

const nowPlus2Weeks = (): string => {
  const date = new Date()
  date.setDate(date.getDate() + DAYS_14)
  return formatDateTimeLocal(date)
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

let homeySettings: HomeySettingsUI = {
  contextKey: '',
  expiry: '',
  password: '',
  username: '',
}

const zoneMapping: Partial<
  Record<string, Partial<GroupAtaState & ZoneSettings>>
> = {}
const hasZoneAtaDevices: Partial<Record<string, boolean>> = {}

let ataCapabilities: Partial<
  Record<keyof GroupAtaState, DriverCapabilitiesOptions>
> = {}

let driverSettings: Partial<Record<string, DriverSetting[]>> = {}

let deviceSettings: Partial<DeviceSettings> = {}
let flatDeviceSettings: Partial<DeviceSetting> = {}

let usernameElement: HTMLInputElement | null = null
let passwordElement: HTMLInputElement | null = null

let errorLogTBodyElement: HTMLTableSectionElement | null = null
let errorCount = 0
let from = ''
let to = ''

const authenticateElement = document.getElementById(
  'authenticate',
) as HTMLButtonElement
const autoAdjustElement = document.getElementById(
  'auto_adjust',
) as HTMLButtonElement
const refreshAtaValues = document.getElementById(
  'refresh-values-melcloud',
) as HTMLButtonElement
const refreshFrostProtectionElement = document.getElementById(
  'refresh-frost-protection',
) as HTMLButtonElement
const refreshHolidayModeElement = document.getElementById(
  'refresh-holiday-mode',
) as HTMLButtonElement
const seeElement = document.getElementById('see') as HTMLButtonElement
const updateAtaValues = document.getElementById(
  'apply-values-melcloud',
) as HTMLButtonElement
const updateFrostProtectionElement = document.getElementById(
  'apply-frost-protection',
) as HTMLButtonElement
const updateHolidayModeElement = document.getElementById(
  'apply-holiday-mode',
) as HTMLButtonElement

const authenticatedElement = document.getElementById(
  'authenticated',
) as HTMLDivElement
const authenticatingElement = document.getElementById(
  'authenticating',
) as HTMLDivElement
const hasZoneAtaDevicesElement = document.getElementById(
  'has-zone-ata-devices',
) as HTMLDivElement
const errorLogElement = document.getElementById('error-log') as HTMLDivElement
const loginElement = document.getElementById('login') as HTMLDivElement
const settingsCommonElement = document.getElementById(
  'settings-common',
) as HTMLDivElement
const valuesAtaElement = document.getElementById(
  'values-melcloud',
) as HTMLDivElement

const sinceElement = document.getElementById('since') as HTMLInputElement
const frostProtectionMinTemperatureElement = document.getElementById(
  'min',
) as HTMLInputElement
frostProtectionMinTemperatureElement.min = String(MIN_FP_TEMPERATURE_MIN)
frostProtectionMinTemperatureElement.max = String(MIN_FP_TEMPERATURE_MAX)
const frostProtectionMaxTemperatureElement = document.getElementById(
  'max',
) as HTMLInputElement
frostProtectionMaxTemperatureElement.min = String(MAX_FP_TEMPERATURE_MIN)
frostProtectionMaxTemperatureElement.max = String(MAX_FP_TEMPERATURE_MAX)
const holidayModeStartDateElement = document.getElementById(
  'start-date',
) as HTMLInputElement
const holidayModeEndDateElement = document.getElementById(
  'end-date',
) as HTMLInputElement

const errorCountLabelElement = document.getElementById(
  'error_count',
) as HTMLLabelElement
const periodLabelElement = document.getElementById('period') as HTMLLabelElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement
const frostProtectionEnabledElement = document.getElementById(
  'enabled-frost-protection',
) as HTMLSelectElement
const holidayModeEnabledElement = document.getElementById(
  'enabled-holiday-mode',
) as HTMLSelectElement

const disableButton = (id: string, value = true): void => {
  const element = document.getElementById(id)
  if (element) {
    if (value) {
      element.classList.add('is-disabled')
      return
    }
    element.classList.remove('is-disabled')
  }
}

const enableButton = (id: string, value = true): void => {
  disableButton(id, !value)
}

const disableButtons = (id: string, value = true): void => {
  const isCommon = id.endsWith('common')
  ;['apply', 'refresh'].forEach((action) => {
    disableButton(`${action}-${id}`, value)
    if (isCommon) {
      Object.keys(deviceSettings).forEach((driverId) => {
        disableButton(`${action}-${id.replace(/common$/u, driverId)}`, value)
      })
    }
  })
}

const enableButtons = (id: string, value = true): void => {
  disableButtons(id, !value)
}

const disableSettingButtons = (): void => {
  disableButton(seeElement.id)
  disableButtons('frost-protection')
  disableButtons('holiday-mode')
  disableButtons('settings-common')
}

const withDisablingButton = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(id)
  await action()
  enableButton(id)
}

const withDisablingButtons = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButtons(id)
  await action()
  enableButtons(id)
}

const hide = (element: HTMLDivElement, value = true): void => {
  element.classList.toggle('hidden', value)
}

const unhide = (element: HTMLDivElement, value = true): void => {
  hide(element, !value)
}

const setDocumentLanguage = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    homey.api('GET', '/language', (error: Error | null, language: string) => {
      if (!error) {
        document.documentElement.lang = language
      }
      resolve()
    })
  })

const fetchHomeySettings = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    homey.get(async (error: Error | null, settings: HomeySettingsUI) => {
      if (error) {
        await homey.alert(error.message)
      } else {
        homeySettings = settings
      }
      resolve()
    })
  })

const fetchDeviceSettings = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      '/settings/devices',
      async (error: Error | null, settings: DeviceSettings) => {
        if (error) {
          await homey.alert(error.message)
        } else {
          deviceSettings = settings
        }
        resolve()
      },
    )
  })

const flattenDeviceSettings = (): void => {
  const groupedSettings = Object.groupBy(
    Object.values(deviceSettings).flatMap((settings) =>
      Object.entries(settings ?? {}).map(([id, values]) => ({
        id,
        values,
      })),
    ),
    ({ id }) => id,
  )
  flatDeviceSettings = Object.fromEntries(
    Object.entries(groupedSettings).map(([id, groupedValues]) => [
      id,
      [...new Set(groupedValues?.flatMap(({ values }) => values) ?? [])],
    ]),
  )
}

const fetchDriverSettings = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      '/settings/drivers',
      async (
        error: Error | null,
        settings: Partial<Record<string, DriverSetting[]>>,
      ) => {
        if (error) {
          await homey.alert(error.message)
        } else {
          driverSettings = settings
        }
        resolve()
      },
    )
  })

const createDivElement = (): HTMLDivElement => {
  const divElement = document.createElement('div')
  divElement.classList.add('homey-form-group')
  return divElement
}

const handleNumericInputElement = (
  element: HTMLInputElement,
  {
    max,
    min,
  }: {
    max?: number
    min?: number
  },
): void => {
  if (element.type === 'number') {
    element.setAttribute('inputmode', 'numeric')
    if (min !== undefined) {
      element.min = String(min)
    }
    if (max !== undefined) {
      element.max = String(max)
    }
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
  max?: number
  min?: number
  placeholder?: string
  value?: string
  id: string
  type: string
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

const createLegendElement = ({
  text,
}: {
  text?: string
}): HTMLLegendElement => {
  const legendElement = document.createElement('legend')
  legendElement.classList.add('homey-form-checkbox-set-title')
  if (text !== undefined) {
    legendElement.innerText = text
  }
  return legendElement
}

const updateCheckboxChildrenElement = (
  element: HTMLInputElement,
  driverId: string,
): void => {
  const [id] = element.id.split('--')
  const values = deviceSettings[driverId]?.[id] as boolean[]
  if (new Set(values).size === NUMBER_1) {
    ;[element.checked] = values
    return
  }
  element.indeterminate = true
  element.addEventListener('change', () => {
    if (element.indeterminate) {
      element.indeterminate = false
    }
  })
}

const createCheckboxElement = (
  { id }: { id: string },
  driverId: string,
): HTMLInputElement => {
  const checkboxElement = document.createElement('input')
  checkboxElement.classList.add('homey-form-checkbox-input')
  checkboxElement.type = 'checkbox'
  checkboxElement.id = `${id}--settings-${driverId}`
  updateCheckboxChildrenElement(checkboxElement, driverId)
  return checkboxElement
}

const updateCommonChildrenElement = (element: HTMLSelectElement): void => {
  const [id] = element.id.split('--')
  const values = flatDeviceSettings[id]
  if (values && new Set(values).size === NUMBER_1) {
    const [value] = values
    element.value = String(value)
    return
  }
  element.value = ''
}

const createOptionElement = ({
  id,
  label,
}: {
  label?: string
  id: string
}): HTMLOptionElement => {
  const optionElement = document.createElement('option')
  optionElement.value = id
  if (label !== undefined) {
    optionElement.innerText = label
  }
  return optionElement
}

const createSelectElement = (
  homey: Homey,
  tag: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = tag
  ;[
    { id: '' },
    ...(values ??
      ['false', 'true'].map((id) => ({
        id,
        label: homey.__(`settings.boolean.${id}`),
      }))),
  ].forEach(({ id, label }: { label?: string; id: string }) => {
    const optionElement = createOptionElement({ id, label })
    selectElement.append(optionElement)
  })
  return selectElement
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
  textSpanElement.innerText = text
  labelElement.append(checkboxElement, checkmarkSpanElement, textSpanElement)
}

const createLabelElement = (
  element: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const isCheckbox = element.type === 'checkbox'
  const labelElement = document.createElement('label')
  labelElement.classList.add(
    isCheckbox ? 'homey-form-checkbox' : 'homey-form-label',
  )
  labelElement.htmlFor = element.id
  if (isCheckbox) {
    addTextToCheckbox(labelElement, element, text)
  } else {
    labelElement.innerText = text
  }
  return labelElement
}

const createCredentialElement = (
  credentialKey: keyof LoginCredentials,
): HTMLInputElement | null => {
  const loginSetting = (driverSettings.login as LoginDriverSetting[]).find(
    (setting) => setting.id === credentialKey,
  )
  if (loginSetting) {
    const { id, placeholder, title: text, type } = loginSetting
    const divElement = createDivElement()
    const inputElement = createInputElement({
      id,
      placeholder,
      type,
      value: homeySettings[id],
    })
    const labelElement = createLabelElement(inputElement, text)
    divElement.append(labelElement, inputElement)
    loginElement.append(divElement)
    return inputElement
  }
  return null
}

const createCredentialElements = (): void => {
  ;[usernameElement, passwordElement] = (['username', 'password'] as const).map(
    createCredentialElement,
  )
}

const handleIntMin = (id: string, min: string): string => {
  if (id === 'SetTemperature') {
    const modeElement = document.getElementById(
      'OperationMode',
    ) as HTMLSelectElement
    if (COOLING_MODES.includes(Number(modeElement.value))) {
      return String(MIN_SET_TEMPERATURE_COOLING)
    }
  }
  return min
}

const int = (
  homey: Homey,
  { id, max, min, value }: HTMLInputElement,
): number => {
  const val = Number.parseInt(value, 10)
  const newMin = handleIntMin(id, min)
  if (Number.isNaN(val) || val < Number(newMin) || val > Number(max)) {
    const labelElement: HTMLLabelElement | null = document.querySelector(
      `label[for="${id}"]`,
    )
    throw new Error(
      homey.__('settings.int_error', {
        max,
        min: newMin,
        name: homey.__(labelElement?.innerText ?? ''),
      }),
    )
  }
  return val
}

const shouldUpdate = (
  id: string,
  value: ValueOf<Settings>,
  driverId?: string,
): boolean => {
  if (value !== null) {
    const setting =
      driverId === undefined ?
        flatDeviceSettings[id]
      : deviceSettings[driverId]?.[id]
    if (setting) {
      if (new Set(setting).size === NUMBER_1) {
        const [settingValue] = setting
        return value !== settingValue
      }
      return true
    }
  }
  return false
}

const processValue = (
  homey: Homey,
  element: HTMLValueElement,
): ValueOf<Settings> => {
  if (element.value) {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min && element.max) {
      return int(homey, element)
    }
    return ['false', 'true'].includes(element.value) ?
        element.value === 'true'
      : element.value
  }
  return null
}

const buildSettingsBody = (
  homey: Homey,
  elements: HTMLValueElement[],
  driverId?: string,
): Settings => {
  const errors: string[] = []
  const settings: Settings = {}
  elements.forEach((element) => {
    try {
      const [id] = element.id.split('--')
      const value = processValue(homey, element)
      if (shouldUpdate(id, value, driverId)) {
        settings[id] = value
      }
    } catch (error) {
      errors.push(getErrorMessage(error))
    }
  })
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
  return settings
}

const buildAtaValuesBody = (homey: Homey): GroupAtaState => {
  const errors: string[] = []
  const body = Object.fromEntries(
    Array.from(valuesAtaElement.querySelectorAll('input, select'))
      .filter(
        (element): element is HTMLValueElement =>
          (element as HTMLValueElement).value !== '' &&
          (element as HTMLValueElement).value !==
            zoneMapping[zoneElement.value]?.[
              element.id as keyof GroupAtaState
            ]?.toString(),
      )
      .map((element) => {
        try {
          return [element.id, processValue(homey, element)]
        } catch (error) {
          errors.push(getErrorMessage(error))
          return [element.id, Number(element.value)]
        }
      }),
  )
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
  return body
}

const generateErrorLogTable = (
  homey: Homey,
  keys: string[],
): HTMLTableSectionElement => {
  const tableElement = document.createElement('table')
  tableElement.classList.add('bordered')
  const theadElement = tableElement.createTHead()
  const rowElement = theadElement.insertRow()
  keys.forEach((key) => {
    const thElement = document.createElement('th')
    thElement.innerText = homey.__(`settings.error_log.columns.${key}`)
    rowElement.append(thElement)
  })
  errorLogElement.append(tableElement)
  return tableElement.createTBody()
}

const generateErrorLogTableData = (
  homey: Homey,
  errors: ErrorDetails[],
): void => {
  errors.forEach((error) => {
    if (!errorLogTBodyElement) {
      errorLogTBodyElement = generateErrorLogTable(homey, Object.keys(error))
    }
    const rowElement = errorLogTBodyElement.insertRow()
    Object.values(error).forEach((value: string) => {
      const cellElement = rowElement.insertCell()
      cellElement.innerText = value
    })
  })
}

const getErrorCountText = (homey: Homey, count: number): string => {
  switch (true) {
    case count < NUMBER_2:
      return homey.__(`settings.error_log.error_count.${String(count)}`)
    case [NUMBER_2, NUMBER_3, NUMBER_4].includes(count % DIVISOR_10) &&
      ![NUMBER_12, NUMBER_13, NUMBER_14].includes(count % DIVISOR_100):
      return homey.__('settings.error_log.error_count.234')
    default:
      return homey.__('settings.error_log.error_count.plural')
  }
}

const updateErrorLogElements = (
  homey: Homey,
  { errors, fromDateHuman, nextFromDate, nextToDate }: ErrorLog,
): void => {
  errorCount += errors.length
  from = fromDateHuman
  to = nextToDate
  errorCountLabelElement.innerText = `${String(errorCount)} ${getErrorCountText(homey, errorCount)}`
  periodLabelElement.innerText = homey.__('settings.error_log.period', { from })
  sinceElement.value = nextFromDate
}

const generateErrorLog = async (homey: Homey): Promise<void> =>
  withDisablingButton(
    seeElement.id,
    async () =>
      new Promise((resolve) => {
        homey.api(
          'GET',
          `/errors?${new URLSearchParams({
            from: sinceElement.value,
            limit: '29',
            offset: '0',
            to,
          } satisfies ErrorLogQuery).toString()}`,
          async (error: Error | null, data: ErrorLog) => {
            if (error) {
              await homey.alert(error.message)
            } else {
              updateErrorLogElements(homey, data)
              generateErrorLogTableData(homey, data.errors)
              resolve()
            }
          },
        )
      }),
  )

const updateZoneMapping = (
  data: Partial<FrostProtectionData | GroupAtaState | HolidayModeData>,
  zone = zoneElement.value,
): void => {
  zoneMapping[zone] = { ...zoneMapping[zone], ...data }
}

const refreshHolidayModeData = (): void => {
  const data = zoneMapping[zoneElement.value]
  if (data) {
    const {
      HMEnabled: isEnabled = false,
      HMEndDate: endDate,
      HMStartDate: startDate,
    } = data
    holidayModeEnabledElement.value = String(isEnabled)
    holidayModeStartDateElement.value = isEnabled ? (startDate ?? '') : ''
    holidayModeEndDateElement.value = isEnabled ? (endDate ?? '') : ''
  }
}

const refreshFrostProtectionData = (): void => {
  const data = zoneMapping[zoneElement.value]
  if (data) {
    const {
      FPEnabled: isEnabled,
      FPMaxTemperature: max,
      FPMinTemperature: min,
    } = data
    frostProtectionEnabledElement.value = String(isEnabled)
    frostProtectionMinTemperatureElement.value = String(min)
    frostProtectionMaxTemperatureElement.value = String(max)
  }
}

const updateAtaValueElement = (id: keyof GroupAtaState): void => {
  const ataValueElement = document.getElementById(id) as HTMLValueElement | null
  if (ataValueElement) {
    ataValueElement.value =
      zoneMapping[zoneElement.value]?.[id]?.toString() ?? ''
  }
}

const refreshAtaValuesElement = (): void => {
  const hasAtaDevices = hasZoneAtaDevices[zoneElement.value] === true
  const ataKeys = Object.keys(ataCapabilities) as (keyof GroupAtaState)[]
  if (hasAtaDevices) {
    ataKeys.forEach(updateAtaValueElement)
  }
  unhide(hasZoneAtaDevicesElement, hasAtaDevices)
}

const refreshZoneSettings = (): void => {
  refreshHolidayModeData()
  refreshFrostProtectionData()
  refreshAtaValuesElement()
}

const fetchHolidayModeData = async (
  homey: Homey,
  zone = zoneElement.value,
): Promise<void> =>
  withDisablingButtons(
    'holiday-mode',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'GET',
          `/settings/holiday_mode/${zone.replace('_', '/')}`,
          (error: Error | null, data: HolidayModeData) => {
            if (!error) {
              updateZoneMapping(data, zone)
              refreshHolidayModeData()
            }
            resolve()
          },
        )
      }),
  )

const fetchFrostProtectionData = async (
  homey: Homey,
  zone = zoneElement.value,
): Promise<void> =>
  withDisablingButtons(
    'frost-protection',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'GET',
          `/settings/frost_protection/${zone.replace('_', '/')}`,
          (error: Error | null, data: FrostProtectionData) => {
            if (!error) {
              updateZoneMapping(data, zone)
              refreshFrostProtectionData()
            }
            resolve()
          },
        )
      }),
  )

const generateAtaValueElement = (
  homey: Homey,
  id: string,
  { title: text, type, values }: DriverCapabilitiesOptions,
): {
  labelElement: HTMLLabelElement | null
  valueElement: HTMLValueElement | null
} => {
  let labelElement: HTMLLabelElement | null = null
  let valueElement: HTMLValueElement | null = null
  if (['boolean', 'enum'].includes(type)) {
    valueElement = createSelectElement(homey, id, values)
    labelElement = createLabelElement(valueElement, text)
  } else if (type === 'number') {
    valueElement = createInputElement({
      id,
      max:
        id in MAX_MAPPING ?
          MAX_MAPPING[id as keyof typeof MAX_MAPPING]
        : undefined,
      min:
        id in MIN_MAPPING ?
          MIN_MAPPING[id as keyof typeof MIN_MAPPING]
        : undefined,
      type,
    })
    labelElement = createLabelElement(valueElement, text)
  }
  updateAtaValueElement(id as keyof GroupAtaState)
  return { labelElement, valueElement }
}

const generateAtaValuesElement = (homey: Homey): void => {
  Object.entries(ataCapabilities).forEach(([id, capability]) => {
    const divElement = createDivElement()
    const { labelElement, valueElement } = generateAtaValueElement(
      homey,
      id,
      capability,
    )
    if (labelElement && valueElement) {
      divElement.append(labelElement, valueElement)
      valuesAtaElement.append(divElement)
    }
  })
}

const fetchAtaValues = async (homey: Homey, zone: string): Promise<void> =>
  withDisablingButtons(
    'values-melcloud',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'GET',
          `/drivers/melcloud/${zone.replace('_', '/')}`,
          async (error: Error | null, data: GroupAtaState) => {
            hasZoneAtaDevices[zone] = error === null
            if (error) {
              if (error.message !== 'No air-to-air device found') {
                await homey.alert(error.message)
              }
            } else {
              updateZoneMapping(data, zone)
              generateAtaValuesElement(homey)
              unhide(hasZoneAtaDevicesElement, zone === zoneElement.value)
            }
            resolve()
          },
        )
      }),
  )

const fetchBuildings = async (homey: Homey): Promise<void> =>
  new Promise((resolve, reject) => {
    homey.api(
      'GET',
      '/buildings',
      async (error: Error | null, buildings: Building[]) => {
        if (error || !buildings.length) {
          if (error) {
            await homey.alert(error.message)
          }
          reject(error ?? new NoDeviceError(homey))
          return
        }
        await Promise.all(
          buildings.map(async ({ id, name }) => {
            const zone = `buildings_${String(id)}`
            if (!document.getElementById(zone)) {
              const optionElement = createOptionElement({
                id: zone,
                label: name,
              })
              optionElement.innerText = name
              zoneElement.append(optionElement)
            }
            await fetchAtaValues(homey, zone)
            await fetchFrostProtectionData(homey, zone)
            await fetchHolidayModeData(homey, zone)
          }),
        )
        await generateErrorLog(homey)
        resolve()
      },
    )
  })

const updateDeviceSettings = (body: Settings, driverId?: string): void => {
  if (driverId !== undefined) {
    Object.entries(body).forEach(([id, value]) => {
      deviceSettings[driverId] ??= {}
      deviceSettings[driverId][id] = [value]
    })
    flattenDeviceSettings()
    return
  }
  Object.entries(body).forEach(([id, value]) => {
    Object.keys(deviceSettings).forEach((driver) => {
      deviceSettings[driver] ??= {}
      deviceSettings[driver][id] = [value]
    })
    flatDeviceSettings[id] = [value]
  })
}

const refreshSettingsCommon = (elements: HTMLSelectElement[]): void => {
  elements.forEach(updateCommonChildrenElement)
}

const refreshSettingsDriver = (
  elements: HTMLInputElement[],
  driverId: string,
): void => {
  elements.forEach((element) => {
    updateCheckboxChildrenElement(element, driverId)
  })
}

const setDeviceSettings = async (
  homey: Homey,
  elements: HTMLValueElement[],
  driverId?: string,
): Promise<void> => {
  const body = buildSettingsBody(homey, elements, driverId)
  if (!Object.keys(body).length) {
    refreshSettingsCommon(elements as HTMLSelectElement[])
    homey.alert(homey.__('settings.devices.apply.nothing')).catch(() => {
      //
    })
    return
  }
  let endPoint = '/settings/devices'
  if (driverId !== undefined) {
    endPoint += `?${new URLSearchParams({ driverId } satisfies {
      driverId: string
    }).toString()}`
  }
  await withDisablingButtons(
    `settings-${driverId ?? 'common'}`,
    async () =>
      new Promise((resolve) => {
        homey.api(
          'PUT',
          endPoint,
          body satisfies Settings,
          async (error: Error | null) => {
            if (!error) {
              updateDeviceSettings(body, driverId)
            }
            await homey.alert(
              error ? error.message : homey.__('settings.success'),
            )
            resolve()
          },
        )
      }),
  )
}

const addApplySettingsEventListener = (
  homey: Homey,
  elements: HTMLValueElement[],
  driverId?: string,
): void => {
  const settings = `settings-${driverId ?? 'common'}`
  const buttonElement = document.getElementById(
    `apply-${settings}`,
  ) as HTMLButtonElement
  buttonElement.addEventListener('click', () => {
    setDeviceSettings(homey, elements, driverId).catch(() => {
      //
    })
  })
}

const addRefreshSettingsEventListener = (
  elements: HTMLValueElement[],
  driverId?: string,
): void => {
  const settings = `settings-${driverId ?? 'common'}`
  const buttonElement = document.getElementById(
    `refresh-${settings}`,
  ) as HTMLButtonElement
  buttonElement.addEventListener('click', () => {
    if (driverId === undefined) {
      refreshSettingsCommon(elements as HTMLSelectElement[])
    } else {
      refreshSettingsDriver(elements as HTMLInputElement[], driverId)
    }
  })
}

const addSettingsEventListeners = (
  homey: Homey,
  elements: HTMLValueElement[],
  driverId?: string,
): void => {
  addApplySettingsEventListener(homey, elements, driverId)
  addRefreshSettingsEventListener(elements, driverId)
}

const fetchAtaCapabilities = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      '/capabilities/drivers/melcloud',
      async (
        error: Error | null,
        capabilities: Partial<
          Record<keyof GroupAtaState, DriverCapabilitiesOptions>
        >,
      ) => {
        if (error) {
          await homey.alert(error.message)
        } else {
          ataCapabilities = capabilities
        }
        resolve()
      },
    )
  })

const setAtaValues = async (homey: Homey): Promise<void> => {
  try {
    const body = buildAtaValuesBody(homey)
    if (!Object.keys(body).length) {
      refreshAtaValuesElement()
      homey.alert(homey.__('settings.devices.apply.nothing')).catch(() => {
        //
      })
      return
    }
    await withDisablingButtons(
      'values-melcloud',
      async () =>
        new Promise((resolve) => {
          homey.api(
            'PUT',
            `/drivers/melcloud/${zoneElement.value.replace('_', '/')}`,
            body satisfies GroupAtaState,
            async (error: Error | null) => {
              if (!error) {
                updateZoneMapping(body)
                refreshAtaValuesElement()
              }
              await homey.alert(
                error ? error.message : homey.__('settings.success'),
              )
              resolve()
            },
          )
        }),
    )
  } catch (error) {
    await homey.alert(getErrorMessage(error))
  }
}

const generateCommonChildrenElements = (homey: Homey): void => {
  ;(driverSettings.options ?? []).forEach(
    ({ id, title: text, type, values }) => {
      const settingId = `${id}--setting`
      if (
        !settingsCommonElement.querySelector(`select[id="${settingId}"]`) &&
        ['checkbox', 'dropdown'].includes(type)
      ) {
        const divElement = createDivElement()
        const selectElement = createSelectElement(homey, settingId, values)
        const labelElement = createLabelElement(selectElement, text)
        updateCommonChildrenElement(selectElement)
        divElement.append(labelElement, selectElement)
        settingsCommonElement.append(divElement)
      }
    },
  )
  addSettingsEventListeners(
    homey,
    Array.from(settingsCommonElement.querySelectorAll('select')),
  )
}

const generateCheckboxChildrenElements = (
  homey: Homey,
  driverId: string,
): void => {
  if (driverSettings[driverId]) {
    const settingsElement = document.getElementById(`settings-${driverId}`)
    if (settingsElement) {
      const fieldSetElement = document.createElement('fieldset')
      fieldSetElement.classList.add('homey-form-checkbox-set')
      let previousGroupLabel = ''
      driverSettings[driverId].forEach(
        ({ groupLabel, id, title: text, type }) => {
          if (type === 'checkbox') {
            if (groupLabel !== previousGroupLabel) {
              previousGroupLabel = groupLabel ?? ''
              const legendElement = createLegendElement({
                text: groupLabel,
              })
              fieldSetElement.append(legendElement)
            }
            const checkboxElement = createCheckboxElement({ id }, driverId)
            const labelElement = createLabelElement(checkboxElement, text)
            fieldSetElement.append(labelElement)
          }
        },
      )
      settingsElement.append(fieldSetElement)
      addSettingsEventListeners(
        homey,
        Array.from(fieldSetElement.querySelectorAll('input')),
        driverId,
      )
      unhide(
        document.getElementById(`has-devices-${driverId}`) as HTMLDivElement,
      )
    }
  }
}

const needsAuthentication = (value = true): void => {
  if (!loginElement.childElementCount) {
    createCredentialElements()
  }
  hide(authenticatedElement, value)
  unhide(authenticatingElement, value)
}

const generatePostLogin = async (homey: Homey): Promise<void> => {
  try {
    await fetchBuildings(homey)
  } catch (error) {
    if (error instanceof NoDeviceError) {
      disableSettingButtons()
      await homey.alert(error.message)
    }
  } finally {
    needsAuthentication(false)
  }
}

const login = async (homey: Homey): Promise<void> => {
  const username = usernameElement?.value ?? ''
  const password = passwordElement?.value ?? ''
  if (!username || !password) {
    homey.alert(homey.__('settings.authenticate.failure')).catch(() => {
      //
    })
    return
  }
  await withDisablingButton(
    authenticateElement.id,
    async () =>
      new Promise((resolve) => {
        homey.api(
          'POST',
          '/sessions',
          { password, username } satisfies LoginCredentials,
          async (error: Error | null, loggedIn: boolean) => {
            if (error || !loggedIn) {
              await homey.alert(
                error ?
                  error.message
                : homey.__('settings.authenticate.failure'),
              )
            } else {
              await generatePostLogin(homey)
            }
            resolve()
          },
        )
      }),
  )
}

const addHolidayModeEventListeners = (): void => {
  holidayModeEnabledElement.addEventListener('change', () => {
    if (holidayModeEnabledElement.value === 'true') {
      holidayModeStartDateElement.value = now()
      holidayModeEndDateElement.value = nowPlus2Weeks()
    } else {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })

  holidayModeStartDateElement.addEventListener('change', () => {
    if (holidayModeStartDateElement.value) {
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
      holidayModeEndDateElement.value = nowPlus2Weeks()
    } else if (holidayModeEnabledElement.value === 'true') {
      if (holidayModeEndDateElement.value) {
        holidayModeStartDateElement.value = now()
      } else {
        holidayModeEnabledElement.value = 'false'
      }
    }
  })

  holidayModeEndDateElement.addEventListener('change', () => {
    if (holidayModeEndDateElement.value) {
      if (!holidayModeStartDateElement.value) {
        holidayModeStartDateElement.value = now()
      }
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
    } else if (
      !holidayModeStartDateElement.value &&
      holidayModeEnabledElement.value === 'true'
    ) {
      holidayModeEnabledElement.value = 'false'
    }
  })

  refreshHolidayModeElement.addEventListener('click', () => {
    refreshHolidayModeData()
  })
}

const updateHolidayModeData = async (
  homey: Homey,
  body: HolidayModeSettings,
): Promise<void> =>
  withDisablingButtons(
    'holiday-mode',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'PUT',
          `/settings/holiday_mode/${zoneElement.value.replace('_', '/')}`,
          body satisfies HolidayModeSettings,
          async (error: Error | null) => {
            if (!error) {
              updateZoneMapping({
                HMEnabled: body.enabled,
                HMEndDate: body.to,
                HMStartDate: body.from,
              })
              refreshHolidayModeData()
            }
            await homey.alert(
              error ? error.message : homey.__('settings.success'),
            )
            resolve()
          },
        )
      }),
  )

const addUpdateHolidayModeEventListener = (homey: Homey): void => {
  updateHolidayModeElement.addEventListener('click', () => {
    updateHolidayModeData(homey, {
      enabled: holidayModeEnabledElement.value === 'true',
      from: holidayModeStartDateElement.value || undefined,
      to: holidayModeEndDateElement.value || undefined,
    }).catch(() => {
      //
    })
  })
}

const addFrostProtectionEventListeners = (): void => {
  ;[
    frostProtectionMinTemperatureElement,
    frostProtectionMaxTemperatureElement,
  ].forEach((element) => {
    element.addEventListener('change', () => {
      if (element.value === 'false') {
        element.value = 'true'
      }
    })
  })

  refreshFrostProtectionElement.addEventListener('click', () => {
    refreshFrostProtectionData()
  })
}

const updateFrostProtectionData = async (
  homey: Homey,
  body: FrostProtectionSettings,
): Promise<void> =>
  withDisablingButtons(
    'frost-protection',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'PUT',
          `/settings/frost_protection/${zoneElement.value.replace('_', '/')}`,
          body satisfies FrostProtectionSettings,
          async (error: Error | null) => {
            if (!error) {
              updateZoneMapping({
                FPEnabled: body.enabled,
                FPMaxTemperature: body.max,
                FPMinTemperature: body.min,
              })
              refreshFrostProtectionData()
            }
            await homey.alert(
              error ? error.message : homey.__('settings.success'),
            )
            resolve()
          },
        )
      }),
  )

const getFPMinAndMax = (homey: Homey): { max: number; min: number } => {
  const errors: string[] = []
  let [min, max] = [
    frostProtectionMinTemperatureElement,
    frostProtectionMaxTemperatureElement,
  ].map((element) => {
    try {
      return int(homey, element)
    } catch (error) {
      errors.push(getErrorMessage(error))
      return Number(element.value)
    }
  })
  if (errors.length) {
    throw new Error(errors.join('\n'))
  }
  if (max < min) {
    ;[min, max] = [max, min]
  }
  return { max: Math.max(max, min + GAP_FP_TEMPERATURE), min }
}

const addUpdateFrostProtectionEventListener = (homey: Homey): void => {
  updateFrostProtectionElement.addEventListener('click', () => {
    updateFrostProtectionData(homey, {
      enabled: frostProtectionEnabledElement.value === 'true',
      ...getFPMinAndMax(homey),
    }).catch((error: unknown) => {
      homey.alert(getErrorMessage(error)).catch(() => {
        //
      })
    })
  })
}

const addAtaValuesEventListeners = (homey: Homey): void => {
  refreshAtaValues.addEventListener('click', () => {
    refreshAtaValuesElement()
  })
  updateAtaValues.addEventListener('click', () => {
    setAtaValues(homey).catch(() => {
      //
    })
  })
}

const addEventListeners = (homey: Homey): void => {
  authenticateElement.addEventListener('click', () => {
    login(homey).catch(() => {
      //
    })
  })
  sinceElement.addEventListener('change', () => {
    if (
      to &&
      sinceElement.value &&
      Date.parse(sinceElement.value) > Date.parse(to)
    ) {
      sinceElement.value = to
      homey.alert(homey.__('settings.error_log.error', { from })).catch(() => {
        //
      })
    }
  })
  seeElement.addEventListener('click', () => {
    generateErrorLog(homey).catch(() => {
      //
    })
  })
  autoAdjustElement.addEventListener('click', () => {
    homey.openURL('https://homey.app/a/com.mecloud.extension').catch(() => {
      //
    })
  })
  zoneElement.addEventListener('change', refreshZoneSettings)
  addHolidayModeEventListeners()
  addUpdateHolidayModeEventListener(homey)
  addFrostProtectionEventListeners()
  addUpdateFrostProtectionEventListener(homey)
  addAtaValuesEventListeners(homey)
}

const load = async (homey: Homey): Promise<void> => {
  addEventListeners(homey)
  generateCommonChildrenElements(homey)
  Object.keys(deviceSettings).forEach((driverId) => {
    generateCheckboxChildrenElements(homey, driverId)
  })
  if (homeySettings.contextKey !== undefined) {
    try {
      await fetchBuildings(homey)
      return
    } catch (_error) {}
  }
  needsAuthentication()
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  await setDocumentLanguage(homey)
  await fetchHomeySettings(homey)
  await fetchAtaCapabilities(homey)
  await fetchDeviceSettings(homey)
  flattenDeviceSettings()
  await fetchDriverSettings(homey)
  await load(homey)
  await homey.ready()
}
