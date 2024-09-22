import type {
  FrostProtectionData,
  GroupAtaState,
  HolidayModeData,
  LoginCredentials,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeySettings'

import type {
  BuildingZone,
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

const SIZE_ONE = 1

const FIRST_LEVEL = 0
const SECOND_LEVEL = 1
const LEVEL_INCREMENT = 1

const MODULUS_DECIMAL = 10
const MODULUS_HUNDRED = 100
const NUMBER_END_2 = 2
const NUMBER_END_3 = 3
const NUMBER_END_4 = 4
const PLURAL_EXCEPTION_12 = 12
const PLURAL_EXCEPTION_13 = 13
const PLURAL_EXCEPTION_14 = 14
const PLURAL_THRESHOLD = 2

const minMapping = { SetTemperature: 10 } as const
const maxMapping = { SetTemperature: 31 } as const
const MIN_SET_TEMPERATURE_COOLING = 16

const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2

const frostProtectionTemperatureRange = { max: 16, min: 4 } as const
const FROST_PROTECTION_TEMPERATURE_GAP = 2

const zoneMapping: Partial<
  Record<string, Partial<GroupAtaState & ZoneSettings>>
> = {}

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
const ataValuesElement = document.getElementById(
  'values_melcloud',
) as HTMLDivElement

const sinceElement = document.getElementById('since') as HTMLInputElement
const frostProtectionMinTemperatureElement = document.getElementById(
  'min',
) as HTMLInputElement
frostProtectionMinTemperatureElement.min = String(
  frostProtectionTemperatureRange.min,
)
frostProtectionMinTemperatureElement.max = String(
  frostProtectionTemperatureRange.max - FROST_PROTECTION_TEMPERATURE_GAP,
)
const frostProtectionMaxTemperatureElement = document.getElementById(
  'max',
) as HTMLInputElement
frostProtectionMaxTemperatureElement.min = String(
  frostProtectionTemperatureRange.min + FROST_PROTECTION_TEMPERATURE_GAP,
)
frostProtectionMaxTemperatureElement.max = String(
  frostProtectionTemperatureRange.max,
)
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

let homeySettings: HomeySettingsUI = {
  contextKey: '',
  expiry: '',
  password: '',
  username: '',
}

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

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

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
  valueElement: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const isCheckbox = valueElement.type === 'checkbox'
  const labelElement = document.createElement('label')
  labelElement.classList.add(
    isCheckbox ? 'homey-form-checkbox' : 'homey-form-label',
  )
  labelElement.htmlFor = valueElement.id
  if (isCheckbox) {
    addTextToCheckbox(labelElement, valueElement, text)
  } else {
    labelElement.innerText = text
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
  wrapWithDiv = true,
): void => {
  if (valueElement) {
    const labelElement = createLabelElement(valueElement, title)
    parentElement.append(
      wrapWithDiv ? createDivElement(labelElement) : labelElement,
    )
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

const createLegendElement = (
  fieldSetElement: HTMLFieldSetElement,
  text?: string,
): void => {
  const legendElement = document.createElement('legend')
  legendElement.classList.add('homey-form-checkbox-set-title')
  if (text !== undefined) {
    legendElement.innerText = text
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

const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (
    !selectElement.querySelector<HTMLOptionElement>(`option[value="${id}"]`)
  ) {
    selectElement.append(new Option(label, id))
  }
}

const createSelectElement = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = id
  ;[
    { id: '', label: '' },
    ...(values ??
      ['false', 'true'].map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ].forEach((option) => {
    createOptionElement(selectElement, option)
  })
  return selectElement
}

const generateCredential = (
  credentialKey: keyof LoginCredentials,
): HTMLInputElement | null => {
  const loginSetting = (driverSettings.login as LoginDriverSetting[]).find(
    ({ id }) => id === credentialKey,
  )
  if (loginSetting) {
    const { id, placeholder, title, type } = loginSetting
    const valueElement = createInputElement({
      id,
      placeholder,
      type,
      value: homeySettings[id],
    })
    createValueElement(loginElement, { title, valueElement })
    return valueElement
  }
  return null
}

const generateCredentials = (): void => {
  ;[usernameElement, passwordElement] = (['username', 'password'] as const).map(
    generateCredential,
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
  const numberValue = Number(value)
  const newMin = handleIntMin(id, min)
  if (
    !Number.isFinite(numberValue) ||
    numberValue < Number(newMin) ||
    numberValue > Number(max)
  ) {
    throw new Error(
      homey.__('settings.intError', {
        max,
        min: newMin,
        name: homey.__(
          document.querySelector<HTMLLabelElement>(`label[for="${id}"]`)
            ?.innerText ?? '',
        ),
      }),
    )
  }
  return numberValue
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
      if (new Set(setting).size === SIZE_ONE) {
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
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return int(homey, element)
    }
    if (['false', 'true'].includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
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
      ataValuesElement.querySelectorAll<HTMLValueElement>('input, select'),
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
    thElement.innerText = homey.__(`settings.errorLog.columns.${key}`)
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
  if (count < PLURAL_THRESHOLD) {
    return homey.__(`settings.errorLog.errorCount.${String(count)}`)
  }
  if (
    [NUMBER_END_2, NUMBER_END_3, NUMBER_END_4].includes(
      count % MODULUS_DECIMAL,
    ) &&
    ![PLURAL_EXCEPTION_12, PLURAL_EXCEPTION_13, PLURAL_EXCEPTION_14].includes(
      count % MODULUS_HUNDRED,
    )
  ) {
    return homey.__('settings.errorLog.errorCount.234')
  }
  return homey.__('settings.errorLog.errorCount.plural')
}

const updateErrorLogElements = (
  homey: Homey,
  { errors, fromDateHuman, nextFromDate, nextToDate }: ErrorLog,
): void => {
  errorCount += errors.length
  from = fromDateHuman
  to = nextToDate
  errorCountLabelElement.innerText = `${String(errorCount)} ${getErrorCountText(homey, errorCount)}`
  periodLabelElement.innerText = homey.__('settings.errorLog.period', { from })
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

const generateAtaValue = (
  homey: Homey,
  {
    id,
    type,
    values,
  }: {
    values?: readonly { id: string; label: string }[]
    id: string
    type: string
  },
): HTMLValueElement | null => {
  if (['boolean', 'enum'].includes(type)) {
    return createSelectElement(homey, id, values)
  }
  if (type === 'number') {
    return createInputElement({
      id,
      max:
        id in maxMapping ?
          maxMapping[id as keyof typeof maxMapping]
        : undefined,
      min:
        id in minMapping ?
          minMapping[id as keyof typeof minMapping]
        : undefined,
      type,
    })
  }
  return null
}

const generateAtaValues = (homey: Homey): void => {
  ataCapabilities.forEach(([id, { title, type, values }]) => {
    createValueElement(ataValuesElement, {
      title,
      valueElement: generateAtaValue(homey, { id, type, values }),
    })
  })
}

const generateZones = async (
  zones: Zone[],
  zoneType = 'buildings',
  level = FIRST_LEVEL,
): Promise<void> =>
  zones.reduce(async (acc, zone) => {
    await acc
    createOptionElement(zoneElement, {
      id: `${zoneType}_${String(zone.id)}`,
      label: `${'···'.repeat(level)} ${zone.name}`,
    })
    if ('areas' in zone && zone.areas) {
      await generateZones(zone.areas, 'areas', level + LEVEL_INCREMENT)
    }
    if ('floors' in zone && zone.floors) {
      await generateZones(zone.floors, 'floors', SECOND_LEVEL)
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
      async (error: Error | null, buildings: BuildingZone[]) => {
        if (error || !buildings.length) {
          if (error) {
            await homey.alert(error.message)
          }
          reject(error ?? new NoDeviceError(homey))
          return
        }
        generateAtaValues(homey)
        await generateZones(buildings)
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

const updateCommonChildrenElement = (element: HTMLSelectElement): void => {
  const [id] = element.id.split('__')
  const values = flatDeviceSettings[id]
  if (values && new Set(values).size === SIZE_ONE) {
    const [value] = values
    element.value = String(value)
    return
  }
  element.value = ''
}

const refreshSettingsCommon = (elements: HTMLSelectElement[]): void => {
  elements.forEach(updateCommonChildrenElement)
}

const updateCheckboxChildrenElement = (
  element: HTMLInputElement,
  driverId: string,
): void => {
  const [id] = element.id.split('__')
  const values = deviceSettings[driverId]?.[id] as boolean[]
  if (new Set(values).size === SIZE_ONE) {
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
    if (driverId === undefined) {
      refreshSettingsCommon(elements as HTMLSelectElement[])
    }
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
    if (driverId !== undefined) {
      refreshSettingsDriver(elements as HTMLInputElement[], driverId)
      return
    }
    refreshSettingsCommon(elements as HTMLSelectElement[])
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

const generateCommonSettings = (homey: Homey): void => {
  ;(driverSettings.options ?? []).forEach(({ id, title, type, values }) => {
    const settingId = `${id}__setting`
    if (
      !settingsCommonElement.querySelector(`select[id="${settingId}"]`) &&
      ['checkbox', 'dropdown'].includes(type)
    ) {
      const valueElement = createSelectElement(homey, settingId, values)
      createValueElement(settingsCommonElement, { title, valueElement })
      updateCommonChildrenElement(valueElement)
    }
  })
  addSettingsEventListeners(
    homey,
    Array.from(settingsCommonElement.querySelectorAll('select')),
  )
}

const generateDriverSettings = (homey: Homey, driverId: string): void => {
  if (driverSettings[driverId]) {
    const settingsElement = document.getElementById(`settings_${driverId}`)
    if (settingsElement) {
      const fieldSetElement = document.createElement('fieldset')
      fieldSetElement.classList.add('homey-form-checkbox-set')
      let previousGroupLabel = ''
      driverSettings[driverId].forEach(({ groupLabel, id, title, type }) => {
        if (type === 'checkbox') {
          if (groupLabel !== previousGroupLabel) {
            previousGroupLabel = groupLabel ?? ''
            createLegendElement(fieldSetElement, groupLabel)
          }
          const valueElement = createCheckboxElement(id, driverId)
          createValueElement(fieldSetElement, { title, valueElement }, false)
          updateCheckboxChildrenElement(valueElement, driverId)
        }
      })
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
    generateCredentials()
  }
  hide(authenticatedElement, value)
  unhide(authenticatingElement, value)
}

const loadPostLogin = async (homey: Homey): Promise<void> => {
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
              await loadPostLogin(homey)
            }
            resolve()
          },
        )
      }),
  )
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
  const isEnabled = holidayModeEnabledElement.value === 'true'
  const endDate = holidayModeEndDateElement.value
  if (isEnabled && endDate === '') {
    homey.alert(homey.__('settings.holidayMode.endDateMissing')).catch(() => {
      //
    })
    return
  }
  updateHolidayModeElement.addEventListener('click', () => {
    setHolidayModeData(homey, {
      enabled: isEnabled,
      from: holidayModeStartDateElement.value || undefined,
      to: endDate,
    }).catch(() => {
      //
    })
  })
}

const addHolidayModeEventListeners = (homey: Homey): void => {
  holidayModeEnabledElement.addEventListener('change', () => {
    if (holidayModeEnabledElement.value === 'false') {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })
  holidayModeStartDateElement.addEventListener('change', () => {
    if (holidayModeStartDateElement.value) {
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
    } else if (
      !holidayModeEndDateElement.value &&
      holidayModeEnabledElement.value === 'true'
    ) {
      holidayModeEnabledElement.value = 'false'
    }
  })
  holidayModeEndDateElement.addEventListener('change', () => {
    if (holidayModeEndDateElement.value) {
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
  addUpdateHolidayModeEventListener(homey)
}

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
  return { max: Math.max(max, min + FROST_PROTECTION_TEMPERATURE_GAP), min }
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

const addFrostProtectionEventListeners = (homey: Homey): void => {
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
      homey.alert(homey.__('settings.errorLog.error', { from })).catch(() => {
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
  addHolidayModeEventListeners(homey)
  addFrostProtectionEventListeners(homey)
  addAtaValuesEventListeners(homey)
}

const load = async (homey: Homey): Promise<void> => {
  addEventListeners(homey)
  generateCommonSettings(homey)
  Object.keys(deviceSettings).forEach((driverId) => {
    generateDriverSettings(homey, driverId)
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
