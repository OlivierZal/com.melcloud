import type {
  FrostProtectionData,
  GroupAtaState,
  HolidayModeData,
  LoginCredentials,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type {
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
  Zone,
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

const MIN_MAPPING = { SetTemperature: 10 }
const MAX_MAPPING = { SetTemperature: 31 }
const MIN_SET_TEMPERATURE_COOLING = 16

const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2

const MIN_FP_TEMPERATURE_MIN = 4
const MIN_FP_TEMPERATURE_MAX = 14
const MAX_FP_TEMPERATURE_MIN = 6
const MAX_FP_TEMPERATURE_MAX = 16
const GAP_FP_TEMPERATURE = 2

const NUMBER_0 = 0
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

let ataCapabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][] = []
let defaultAtaValues: Partial<Record<keyof GroupAtaState, null>> = {}

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
  'refresh_values_melcloud',
) as HTMLButtonElement
const refreshFrostProtectionElement = document.getElementById(
  'refresh_frost_protection',
) as HTMLButtonElement
const refreshHolidayModeElement = document.getElementById(
  'refresh_holiday_mode',
) as HTMLButtonElement
const seeElement = document.getElementById('see') as HTMLButtonElement
const updateAtaValues = document.getElementById(
  'apply_values_melcloud',
) as HTMLButtonElement
const updateFrostProtectionElement = document.getElementById(
  'apply_frost_protection',
) as HTMLButtonElement
const updateHolidayModeElement = document.getElementById(
  'apply_holiday_mode',
) as HTMLButtonElement

const authenticatedElement = document.getElementById(
  'authenticated',
) as HTMLDivElement
const authenticatingElement = document.getElementById(
  'authenticating',
) as HTMLDivElement
const hasZoneAtaDevicesElement = document.getElementById(
  'has_zone_ata_devices',
) as HTMLDivElement
const errorLogElement = document.getElementById('error_log') as HTMLDivElement
const loginElement = document.getElementById('login') as HTMLDivElement
const settingsCommonElement = document.getElementById(
  'settings_common',
) as HTMLDivElement
const valuesAtaElement = document.getElementById(
  'values_melcloud',
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
  'start_date',
) as HTMLInputElement
const holidayModeEndDateElement = document.getElementById(
  'end_date',
) as HTMLInputElement

const errorCountLabelElement = document.getElementById(
  'error_count',
) as HTMLLabelElement
const periodLabelElement = document.getElementById('period') as HTMLLabelElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement
const frostProtectionEnabledElement = document.getElementById(
  'enabled_frost_protection',
) as HTMLSelectElement
const holidayModeEnabledElement = document.getElementById(
  'enabled_holiday_mode',
) as HTMLSelectElement

const disableButton = (id: string, value = true): void => {
  const element = document.getElementById(id)
  if (value) {
    element?.classList.add('is-disabled')
    return
  }
  element?.classList.remove('is-disabled')
}

const enableButton = (id: string, value = true): void => {
  disableButton(id, !value)
}

const disableButtons = (id: string, value = true): void => {
  const isCommon = id.endsWith('common')
  ;['apply', 'refresh'].forEach((action) => {
    disableButton(`${action}_${id}`, value)
    if (isCommon) {
      Object.keys(deviceSettings).forEach((driverId) => {
        disableButton(`${action}_${id.replace(/common$/u, driverId)}`, value)
      })
    }
  })
}

const enableButtons = (id: string, value = true): void => {
  disableButtons(id, !value)
}

const disableSettingButtons = (): void => {
  disableButton(seeElement.id)
  disableButtons('frost_protection')
  disableButtons('holiday_mode')
  disableButtons('settings_common')
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

const fetchFlattenDeviceSettings = (): void => {
  const groupedSettings = Object.groupBy(
    Object.values(deviceSettings).flatMap((settings) =>
      Object.entries(settings ?? {}).map(([id, values]) => ({ id, values })),
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
          fetchFlattenDeviceSettings()
        }
        resolve()
      },
    )
  })

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
  { max, min }: { max?: number; min?: number },
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
  const [id] = element.id.split('__')
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
  checkboxElement.id = `${id}__settings_${driverId}`
  updateCheckboxChildrenElement(checkboxElement, driverId)
  return checkboxElement
}

const updateCommonChildrenElement = (element: HTMLSelectElement): void => {
  const [id] = element.id.split('__')
  const values = flatDeviceSettings[id]
  if (values && new Set(values).size === NUMBER_1) {
    const [value] = values
    element.value = String(value)
    return
  }
  element.value = ''
}

const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { label?: string; id: string },
): HTMLOptionElement => {
  let optionElement = document.getElementById(id) as HTMLOptionElement | null
  if (!optionElement) {
    optionElement = document.createElement('option')
    optionElement.value = id
    if (label !== undefined) {
      optionElement.innerText = label
    }
    selectElement.append(optionElement)
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
  ].forEach((option) => {
    createOptionElement(selectElement, option)
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
    ({ id }) => id === credentialKey,
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
    if ([MODE_AUTO, MODE_COOL, MODE_DRY].includes(Number(modeElement.value))) {
      return String(MIN_SET_TEMPERATURE_COOLING)
    }
  }
  return min
}

const int = (
  homey: Homey,
  { id, max, min, value }: HTMLInputElement,
): number => {
  const val = Number(value)
  const newMin = handleIntMin(id, min)
  if (!Number.isFinite(val) || val < Number(newMin) || val > Number(max)) {
    throw new Error(
      homey.__('settings.int_error', {
        max,
        min: newMin,
        name: homey.__(
          document.querySelector<HTMLLabelElement>(`label[for="${id}"]`)
            ?.innerText ?? '',
        ),
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
    switch (true) {
      case element.type === 'checkbox':
        return element.indeterminate ? null : element.checked
      case element.type === 'number' &&
        element.min !== '' &&
        element.max !== '':
        return int(homey, element)
      case ['false', 'true'].includes(element.value):
        return element.value === 'true'
      default:
        return Number.isFinite(Number(element.value)) ?
            Number(element.value)
          : element.value
    }
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
      const [id] = element.id.split('__')
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
    Array.from(
      valuesAtaElement.querySelectorAll<HTMLValueElement>('input, select'),
    )
      .filter(
        ({ id, value }) =>
          value !== '' &&
          value !==
            zoneMapping[zoneElement.value]?.[
              id as keyof GroupAtaState
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
            }
            resolve()
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
  ataCapabilities.forEach(([ataKey]) => {
    updateAtaValueElement(ataKey)
  })
}

const fetchHolidayModeData = async (
  homey: Homey,
  zone = zoneElement.value,
): Promise<void> =>
  withDisablingButtons(
    'holiday_mode',
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
    'frost_protection',
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

const fetchAtaValues = async (
  homey: Homey,
  zone = zoneElement.value,
): Promise<void> =>
  withDisablingButtons(
    'values_melcloud',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'GET',
          `/drivers/melcloud/${zone.replace('_', '/')}`,
          async (error: Error | null, data: GroupAtaState) => {
            unhide(hasZoneAtaDevicesElement, error === null)
            if (!error) {
              updateZoneMapping({ ...defaultAtaValues, ...data }, zone)
              refreshAtaValuesElement()
            } else if (error.message !== 'No air-to-air device found') {
              await homey.alert(error.message)
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
  return { labelElement, valueElement }
}

const generateAtaValuesElement = (homey: Homey): void => {
  ataCapabilities.forEach((ataCapability) => {
    const divElement = createDivElement()
    const { labelElement, valueElement } = generateAtaValueElement(
      homey,
      ...ataCapability,
    )
    if (labelElement && valueElement) {
      divElement.append(labelElement, valueElement)
      valuesAtaElement.append(divElement)
    }
  })
}

const createZoneElements = async (
  zones: Zone[],
  zoneType: string,
  level = NUMBER_0,
): Promise<void> =>
  zones.reduce(async (acc, { areas, floors, id, name }) => {
    await acc
    createOptionElement(zoneElement, {
      id: `${zoneType}_${String(id)}`,
      label: `${'···'.repeat(level)} ${name}`,
    })
    if (areas) {
      await createZoneElements(areas, 'areas', level + NUMBER_1)
    }
    if (floors) {
      await createZoneElements(floors, 'floors', NUMBER_1)
    }
  }, Promise.resolve())

const fetchZoneSettings = async (homey: Homey): Promise<void> => {
  await fetchAtaValues(homey)
  await fetchFrostProtectionData(homey)
  await fetchHolidayModeData(homey)
}

const fetchBuildings = async (homey: Homey): Promise<void> =>
  new Promise((resolve, reject) => {
    homey.api(
      'GET',
      '/buildings',
      async (error: Error | null, buildings: Zone[]) => {
        if (error || !buildings.length) {
          if (error) {
            await homey.alert(error.message)
          }
          reject(error ?? new NoDeviceError(homey))
          return
        }
        generateAtaValuesElement(homey)
        await createZoneElements(buildings, 'buildings')
        await generateErrorLog(homey)
        await fetchZoneSettings(homey)
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
    fetchFlattenDeviceSettings()
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
    `settings_${driverId ?? 'common'}`,
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
  const settings = `settings_${driverId ?? 'common'}`
  const buttonElement = document.getElementById(
    `apply_${settings}`,
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
  const settings = `settings_${driverId ?? 'common'}`
  const buttonElement = document.getElementById(
    `refresh_${settings}`,
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
        capabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][],
      ) => {
        if (error) {
          await homey.alert(error.message)
        } else {
          ataCapabilities = capabilities
          defaultAtaValues = Object.fromEntries(
            ataCapabilities.map(([ataKey]) => [ataKey, null]),
          )
        }
        resolve()
      },
    )
  })

const setAtaValues = async (homey: Homey): Promise<void> => {
  try {
    const body = buildAtaValuesBody(homey)
    await withDisablingButtons(
      'values_melcloud',
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
      const settingId = `${id}__setting`
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
    const settingsElement = document.getElementById(`settings_${driverId}`)
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
        document.getElementById(`has_devices_${driverId}`) as HTMLDivElement,
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

const setHolidayModeData = async (
  homey: Homey,
  { enabled, from: startDate, to: endDate }: HolidayModeSettings,
): Promise<void> =>
  withDisablingButtons(
    'holiday_mode',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'PUT',
          `/settings/holiday_mode/${zoneElement.value.replace('_', '/')}`,
          { enabled, from, to } satisfies HolidayModeSettings,
          async (error: Error | null) => {
            if (!error) {
              updateZoneMapping({
                HMEnabled: enabled,
                HMEndDate: endDate,
                HMStartDate: startDate,
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
    setHolidayModeData(homey, {
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

const setFrostProtectionData = async (
  homey: Homey,
  { enabled, max, min }: FrostProtectionSettings,
): Promise<void> =>
  withDisablingButtons(
    'frost_protection',
    async () =>
      new Promise((resolve) => {
        homey.api(
          'PUT',
          `/settings/frost_protection/${zoneElement.value.replace('_', '/')}`,
          { enabled, max, min } satisfies FrostProtectionSettings,
          async (error: Error | null) => {
            if (!error) {
              updateZoneMapping({
                FPEnabled: enabled,
                FPMaxTemperature: max,
                FPMinTemperature: min,
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
    try {
      const { max, min } = getFPMinAndMax(homey)
      setFrostProtectionData(homey, {
        enabled: frostProtectionEnabledElement.value === 'true',
        max,
        min,
      }).catch(() => {
        //
      })
    } catch (error) {
      homey.alert(getErrorMessage(error)).catch(() => {
        //
      })
    }
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
  zoneElement.addEventListener('change', () => {
    fetchZoneSettings(homey).catch(() => {
      //
    })
  })
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
  await fetchDriverSettings(homey)
  await load(homey)
  await homey.ready()
}
