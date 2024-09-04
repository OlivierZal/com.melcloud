import type {
  BuildingModel,
  BuildingSettings,
  FrostProtectionData,
  GroupAtaState,
  HolidayModeData,
  LoginCredentials,
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

const MIN_TEMPERATURE_MIN = 4
const MIN_TEMPERATURE_MAX = 14
const MAX_TEMPERATURE_MIN = 6
const MAX_TEMPERATURE_MAX = 16

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

const buildingMapping: Partial<
  Record<string, BuildingSettings & GroupAtaState>
> = {}
const hasBuildingAtaDevices: Partial<Record<string, boolean>> = {}

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
const hasBuildingAtaDevicesElement = document.getElementById(
  'has-building-ata-devices',
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
frostProtectionMinTemperatureElement.min = String(MIN_TEMPERATURE_MIN)
frostProtectionMinTemperatureElement.max = String(MIN_TEMPERATURE_MAX)
const frostProtectionMaxTemperatureElement = document.getElementById(
  'max',
) as HTMLInputElement
frostProtectionMaxTemperatureElement.min = String(MAX_TEMPERATURE_MIN)
frostProtectionMaxTemperatureElement.max = String(MAX_TEMPERATURE_MAX)
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

const buildingElement = document.getElementById(
  'buildings',
) as HTMLSelectElement
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

const disableButtons = (setting: string, value = true): void => {
  const [baseSetting, suffix] = setting.split('-')
  ;['apply', 'refresh'].forEach((action) => {
    disableButton(`${action}-${setting}`, value)
    if (suffix === 'common') {
      Object.keys(deviceSettings).forEach((driverId) => {
        disableButton(`${action}-${baseSetting}-${driverId}`, value)
      })
    }
  })
}

const disableSettingsButtons = (): void => {
  disableButtons('frost-protection')
  disableButtons('holiday-mode')
  disableButtons('settings-common')
}

const enableButtons = (setting: string, value = true): void => {
  disableButtons(setting, !value)
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

const createInputElement = ({
  id,
  placeholder,
  type,
  value,
}: {
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
  if (type === 'number') {
    inputElement.setAttribute('inputmode', 'numeric')
  }
  if (placeholder !== undefined) {
    inputElement.placeholder = placeholder
  }
  return inputElement
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
  { text }: { text: string },
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
    const divElement = createDivElement()
    const inputElement = createInputElement({
      id: loginSetting.id,
      placeholder: loginSetting.placeholder,
      type: loginSetting.type,
      value: homeySettings[loginSetting.id],
    })
    const labelElement = createLabelElement(inputElement, {
      text: loginSetting.title,
    })
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

const int = (homey: Homey, element: HTMLInputElement): number => {
  const value = Number.parseInt(element.value, 10)
  if (
    Number.isNaN(value) ||
    value < Number(element.min) ||
    value > Number(element.max)
  ) {
    const labelElement: HTMLLabelElement | null = document.querySelector(
      `label[for="${element.id}"]`,
    )
    throw new Error(
      homey.__('settings.int_error', {
        max: element.max,
        min: element.min,
        name: homey.__(labelElement?.innerText ?? ''),
      }),
    )
  }
  return value
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
    if (element.type === 'number') {
      return Number(element.value)
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
  const settings: Settings = {}
  elements.forEach((element) => {
    const [id] = element.id.split('--')
    const value = processValue(homey, element)
    if (shouldUpdate(id, value, driverId)) {
      settings[id] = value
    }
  })
  return settings
}

const buildAtaValuesBody = (homey: Homey): GroupAtaState =>
  Object.fromEntries(
    Array.from(valuesAtaElement.querySelectorAll('input, select'))
      .filter(
        (element) =>
          (element as HTMLValueElement).value !== '' &&
          (element as HTMLValueElement).value !==
            buildingMapping[buildingElement.value]?.[
              element.id as keyof GroupAtaState
            ]?.toString(),
      )
      .map((element) => [
        element.id,
        processValue(homey, element as HTMLValueElement),
      ]),
  )

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
        seeElement.classList.remove('is-disabled')
        if (error) {
          await homey.alert(error.message)
        } else {
          updateErrorLogElements(homey, data)
          generateErrorLogTableData(homey, data.errors)
          resolve()
        }
      },
    )
  })

const refreshHolidayModeData = (): void => {
  const data = buildingMapping[buildingElement.value]
  if (data) {
    const {
      HMEnabled: isEnabled,
      HMEndDate: endDate,
      HMStartDate: startDate,
    } = data
    holidayModeEnabledElement.value = String(isEnabled)
    holidayModeStartDateElement.value = isEnabled ? (startDate ?? '') : ''
    holidayModeEndDateElement.value = isEnabled ? (endDate ?? '') : ''
  }
}

const refreshFrostProtectionData = (): void => {
  const data = buildingMapping[buildingElement.value]
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
      buildingMapping[buildingElement.value]?.[id]?.toString() ?? ''
  }
}

const refreshAtaValuesElement = (): void => {
  const hasAtaDevices = hasBuildingAtaDevices[buildingElement.value] === true
  const ataKeys = Object.keys(ataCapabilities) as (keyof GroupAtaState)[]
  if (hasAtaDevices) {
    ataKeys.forEach(updateAtaValueElement)
  }
  unhide(hasBuildingAtaDevicesElement, hasAtaDevices)
}

const refreshBuildingSettings = (): void => {
  refreshHolidayModeData()
  refreshFrostProtectionData()
  refreshAtaValuesElement()
}

const updateBuildingMapping = (
  data: FrostProtectionData | GroupAtaState | HolidayModeData,
  buildingId = buildingElement.value,
): void => {
  if (buildingMapping[buildingId]) {
    buildingMapping[buildingId] = { ...buildingMapping[buildingId], ...data }
  }
}

const fetchHolidayModeData = async (
  homey: Homey,
  buildingId = buildingElement.value,
): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      `/settings/holiday_mode/buildings/${buildingId}`,
      (error: Error | null, data: HolidayModeData) => {
        if (!error) {
          updateBuildingMapping(data, buildingId)
          refreshHolidayModeData()
        }
        enableButtons('holiday-mode')
        resolve()
      },
    )
  })

const fetchFrostProtectionData = async (
  homey: Homey,
  buildingId = buildingElement.value,
): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      `/settings/frost_protection/buildings/${buildingId}`,
      (error: Error | null, data: FrostProtectionData) => {
        if (!error) {
          updateBuildingMapping(data, buildingId)
          refreshFrostProtectionData()
        }
        enableButtons('frost-protection')
        resolve()
      },
    )
  })

const createAtaValueSelectElement = (
  homey: Homey,
  tag: string,
  capability: DriverCapabilitiesOptions,
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = tag
  ;[
    { id: '' },
    ...(capability.type === 'boolean' ?
      ['false', 'true'].map((id) => ({
        id,
        label: homey.__(`settings.boolean.${id}`),
      }))
    : (capability.values ?? [])),
  ].forEach(({ id, label }: { label?: string; id: string }) => {
    const optionElement = document.createElement('option')
    optionElement.value = id
    if (label !== undefined) {
      optionElement.innerText = label
    }
    selectElement.append(optionElement)
  })
  return selectElement
}

const generateAtaValueElement = (
  homey: Homey,
  id: string,
  capability: DriverCapabilitiesOptions,
): {
  labelElement: HTMLLabelElement | null
  valueElement: HTMLValueElement | null
} => {
  let labelElement: HTMLLabelElement | null = null
  let valueElement: HTMLValueElement | null = null
  if (['boolean', 'enum'].includes(capability.type)) {
    valueElement = createAtaValueSelectElement(homey, id, capability)
    labelElement = createLabelElement(valueElement, {
      text: capability.title,
    })
  } else if (capability.type === 'number') {
    valueElement = createInputElement({
      id,
      type: 'number',
    })
    labelElement = createLabelElement(valueElement, {
      text: capability.title,
    })
  }
  return { labelElement, valueElement }
}

const generateAtaValuesElement = (homey: Homey): void => {
  Object.entries(ataCapabilities).forEach(([id, capability]) => {
    const ataValueElement = document.getElementById(id)
    if (!ataValueElement) {
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
    }
    updateAtaValueElement(id as keyof GroupAtaState)
  })
}

const fetchAtaValues = async (
  homey: Homey,
  buildingId: string,
): Promise<void> =>
  new Promise((resolve) => {
    homey.api(
      'GET',
      `/drivers/melcloud/buildings/${String(buildingId)}`,
      async (error: Error | null, data: GroupAtaState) => {
        hasBuildingAtaDevices[buildingId] = error === null
        if (error) {
          if (error.message !== 'No air-to-air device found') {
            await homey.alert(error.message)
          }
        } else {
          updateBuildingMapping(data, buildingId)
          generateAtaValuesElement(homey)
          unhide(
            hasBuildingAtaDevicesElement,
            buildingId === buildingElement.value,
          )
        }
        enableButtons('values-melcloud')
        resolve()
      },
    )
  })

const fetchBuildings = async (homey: Homey): Promise<void> =>
  new Promise((resolve, reject) => {
    homey.api(
      'GET',
      '/buildings',
      async (error: Error | null, buildings: BuildingModel[]) => {
        if (error || !buildings.length) {
          if (error) {
            await homey.alert(error.message)
          }
          reject(error ?? new NoDeviceError(homey))
          return
        }
        await Promise.all(
          buildings.map(async ({ data, id, name }) => {
            const buildingId = String(id)
            if (!document.getElementById(buildingId)) {
              const optionElement = document.createElement('option')
              optionElement.value = buildingId
              optionElement.innerText = name
              buildingElement.append(optionElement)
              buildingMapping[buildingId] = data
            }
            await fetchAtaValues(homey, buildingId)
            await fetchFrostProtectionData(homey, buildingId)
            await fetchHolidayModeData(homey, buildingId)
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

const setDeviceSettings = async (
  homey: Homey,
  elements: HTMLValueElement[],
  driverId?: string,
): Promise<void> => {
  const body = buildSettingsBody(homey, elements, driverId)
  if (!Object.keys(body).length) {
    homey.alert(homey.__('settings.devices.apply.nothing')).catch(() => {
      //
    })
    return
  }
  const settings = `settings-${driverId ?? 'common'}`
  disableButtons(settings)
  let endPoint = '/settings/devices'
  if (driverId !== undefined) {
    endPoint += `?${new URLSearchParams({
      driverId,
    } satisfies { driverId: string }).toString()}`
  }
  return new Promise((resolve) => {
    homey.api(
      'PUT',
      endPoint,
      body satisfies Settings,
      async (error: Error | null) => {
        if (!error) {
          updateDeviceSettings(body, driverId)
        }
        await homey.alert(error ? error.message : homey.__('settings.success'))
        enableButtons(settings)
        resolve()
      },
    )
  })
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

const addRefreshSettingsCommonEventListener = (
  elements: HTMLSelectElement[],
): void => {
  elements.forEach(updateCommonChildrenElement)
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

const addRefreshSettingsDriverEventListener = (
  elements: HTMLInputElement[],
  driverId: string,
): void => {
  elements.forEach((element) => {
    updateCheckboxChildrenElement(element, driverId)
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
      addRefreshSettingsCommonEventListener(elements as HTMLSelectElement[])
    } else {
      addRefreshSettingsDriverEventListener(
        elements as HTMLInputElement[],
        driverId,
      )
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

const setAtaValues = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    const body = buildAtaValuesBody(homey)
    if (!Object.keys(body).length) {
      homey.alert(homey.__('settings.devices.apply.nothing')).catch(() => {
        //
      })
      return
    }
    disableButtons('values-melcloud')
    homey.api(
      'PUT',
      `/drivers/melcloud/buildings/${buildingElement.value}`,
      body satisfies GroupAtaState,
      async (error: Error | null) => {
        if (!error) {
          updateBuildingMapping(body)
          refreshAtaValuesElement()
        }
        await homey.alert(error ? error.message : homey.__('settings.success'))
        enableButtons('values-melcloud')
        resolve()
      },
    )
  })

const createSettingSelectElement = (
  homey: Homey,
  setting: DriverSetting,
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = `${setting.id}--setting`
  ;[
    { id: '' },
    ...(setting.type === 'checkbox' ?
      ['false', 'true'].map((id) => ({
        id,
        label: homey.__(`settings.boolean.${id}`),
      }))
    : (setting.values ?? [])),
  ].forEach(({ id, label }: { label?: string; id: string }) => {
    const optionElement = document.createElement('option')
    optionElement.value = id
    if (label !== undefined) {
      optionElement.innerText = label
    }
    selectElement.append(optionElement)
  })
  updateCommonChildrenElement(selectElement)
  return selectElement
}

const generateCommonChildrenElements = (homey: Homey): void => {
  ;(driverSettings.options ?? []).forEach((setting) => {
    if (
      !settingsCommonElement.querySelector(
        `select[id="${setting.id}--setting"]`,
      ) &&
      ['checkbox', 'dropdown'].includes(setting.type)
    ) {
      const divElement = createDivElement()
      const selectElement = createSettingSelectElement(homey, setting)
      const labelElement = createLabelElement(selectElement, {
        text: setting.title,
      })
      divElement.append(labelElement, selectElement)
      settingsCommonElement.append(divElement)
    }
  })
  addSettingsEventListeners(
    homey,
    Array.from(settingsCommonElement.querySelectorAll('select')),
  )
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
      driverSettings[driverId].forEach((setting) => {
        if (setting.type === 'checkbox') {
          if (setting.groupLabel !== previousGroupLabel) {
            previousGroupLabel = setting.groupLabel ?? ''
            const legendElement = createLegendElement({
              text: setting.groupLabel,
            })
            fieldSetElement.append(legendElement)
          }
          const checkboxElement = createCheckboxElement(
            { id: setting.id },
            driverId,
          )
          const labelElement = createLabelElement(checkboxElement, {
            text: setting.title,
          })
          fieldSetElement.append(labelElement)
        }
      })
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
      seeElement.classList.add('is-disabled')
      disableSettingsButtons()
      await homey.alert(error.message)
    }
  } finally {
    needsAuthentication(false)
  }
}

const login = async (homey: Homey): Promise<void> =>
  new Promise((resolve) => {
    const username = usernameElement?.value ?? ''
    const password = passwordElement?.value ?? ''
    if (!username || !password) {
      homey.alert(homey.__('settings.authenticate.failure')).catch(() => {
        //
      })
      return
    }
    homey.api(
      'POST',
      '/sessions',
      { password, username } satisfies LoginCredentials,
      async (error: Error | null, loggedIn: boolean) => {
        authenticateElement.classList.remove('is-disabled')
        if (error || !loggedIn) {
          await homey.alert(
            error ? error.message : homey.__('settings.authenticate.failure'),
          )
        } else {
          await generatePostLogin(homey)
        }
        resolve()
      },
    )
  })

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
  new Promise((resolve) => {
    homey.api(
      'PUT',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      body satisfies HolidayModeSettings,
      async (error: Error | null) => {
        if (!error) {
          await fetchHolidayModeData(homey)
        }
        await homey.alert(error ? error.message : homey.__('settings.success'))
        enableButtons('holiday-mode')
        resolve()
      },
    )
  })

const addUpdateHolidayModeEventListener = (homey: Homey): void => {
  updateHolidayModeElement.addEventListener('click', () => {
    disableButtons('holiday-mode')
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
  new Promise((resolve) => {
    homey.api(
      'PUT',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      body satisfies FrostProtectionSettings,
      async (error: Error | null) => {
        if (!error) {
          await fetchFrostProtectionData(homey)
        }
        await homey.alert(error ? error.message : homey.__('settings.success'))
        enableButtons('frost-protection')
        resolve()
      },
    )
  })

const fixAndGetFpMinMax = (homey: Homey): { max: number; min: number } => {
  const errors: string[] = []
  const [min, max] = [
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
  return { max, min }
}

const addUpdateFrostProtectionEventListener = (homey: Homey): void => {
  updateFrostProtectionElement.addEventListener('click', () => {
    try {
      const { max, min } = fixAndGetFpMinMax(homey)
      disableButtons('frost-protection')
      updateFrostProtectionData(homey, {
        enabled: frostProtectionEnabledElement.value === 'true',
        max,
        min,
      }).catch(() => {
        //
      })
    } catch (error: unknown) {
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
    authenticateElement.classList.add('is-disabled')
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
    seeElement.classList.add('is-disabled')
    generateErrorLog(homey).catch(() => {
      //
    })
  })
  autoAdjustElement.addEventListener('click', () => {
    homey.openURL('https://homey.app/a/com.mecloud.extension').catch(() => {
      //
    })
  })
  buildingElement.addEventListener('change', refreshBuildingSettings)
  addHolidayModeEventListeners()
  addUpdateHolidayModeEventListener(homey)
  addFrostProtectionEventListeners()
  addUpdateFrostProtectionEventListener(homey)
  addAtaValuesEventListeners(homey)
}

const load = async (homey: Homey): Promise<void> => {
  addEventListeners(homey)
  generateCommonChildrenElements(homey)
  if (homeySettings.contextKey !== undefined) {
    Object.keys(deviceSettings).forEach((driverId) => {
      generateCheckboxChildrenElements(homey, driverId)
    })
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
