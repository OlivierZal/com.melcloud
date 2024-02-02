/* eslint-disable @typescript-eslint/no-unsafe-call */
import type {
  Building,
  BuildingData,
  DeviceSetting,
  DeviceSettings,
  DriverSetting,
  ErrorDetails,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionSettings,
  HolidayModeData,
  HolidayModeSettings,
  HomeySettingsUI,
  LoginCredentials,
  LoginDriverSetting,
  Settings,
  ValueOf,
} from '../types'
import type Homey from 'homey/lib/Homey'

const FP_MIN_MAX_GAP = 2

let homeySettings: HomeySettingsUI = {
  contextKey: '',
  expiry: '',
  password: '',
  username: '',
}
let deviceSettings: DeviceSettings = {}
let flatDeviceSettings: DeviceSetting = {}
let driverSettingsAll: DriverSetting[] = []
let driverSettingsCommon: DriverSetting[] = []
let driverSettingsDrivers: Record<string, DriverSetting[]> = {}
let usernameElement: HTMLInputElement | null = null
let passwordElement: HTMLInputElement | null = null

const minMinTemperature = 4
const maxMinTemperature = 14
const minMaxTemperature = 6
const maxMaxTemperature = 16

const authenticateElement: HTMLButtonElement = document.getElementById(
  'authenticate',
) as HTMLButtonElement
const autoAdjustElement: HTMLButtonElement = document.getElementById(
  'auto_adjust',
) as HTMLButtonElement
const refreshFrostProtectionElement: HTMLButtonElement =
  document.getElementById('refresh-frost-protection') as HTMLButtonElement
const refreshHolidayModeElement: HTMLButtonElement = document.getElementById(
  'refresh-holiday-mode',
) as HTMLButtonElement
const seeElement: HTMLButtonElement = document.getElementById(
  'see',
) as HTMLButtonElement
const updateFrostProtectionElement: HTMLButtonElement = document.getElementById(
  'apply-frost-protection',
) as HTMLButtonElement
const updateHolidayModeElement: HTMLButtonElement = document.getElementById(
  'apply-holiday-mode',
) as HTMLButtonElement

const authenticatedElement: HTMLDivElement = document.getElementById(
  'authenticated',
) as HTMLDivElement
const authenticatingElement: HTMLDivElement = document.getElementById(
  'authenticating',
) as HTMLDivElement
const errorLogElement: HTMLDivElement = document.getElementById(
  'error-log',
) as HTMLDivElement
const loginElement: HTMLDivElement = document.getElementById(
  'login',
) as HTMLDivElement
const settingsCommonElement: HTMLDivElement = document.getElementById(
  'settings-common',
) as HTMLDivElement

const sinceElement: HTMLInputElement = document.getElementById(
  'since',
) as HTMLInputElement
const frostProtectionMinTemperatureElement: HTMLInputElement =
  document.getElementById('min') as HTMLInputElement
frostProtectionMinTemperatureElement.min = String(minMinTemperature)
frostProtectionMinTemperatureElement.max = String(maxMinTemperature)
const frostProtectionMaxTemperatureElement: HTMLInputElement =
  document.getElementById('max') as HTMLInputElement
frostProtectionMaxTemperatureElement.min = String(minMaxTemperature)
frostProtectionMaxTemperatureElement.max = String(maxMaxTemperature)
const holidayModeStartDateElement: HTMLInputElement = document.getElementById(
  'start-date',
) as HTMLInputElement
const holidayModeEndDateElement: HTMLInputElement = document.getElementById(
  'end-date',
) as HTMLInputElement

const errorCountLabelElement: HTMLLabelElement = document.getElementById(
  'error_count',
) as HTMLLabelElement
const periodLabelElement: HTMLLabelElement = document.getElementById(
  'period',
) as HTMLLabelElement

const buildingElement: HTMLSelectElement = document.getElementById(
  'buildings',
) as HTMLSelectElement
const frostProtectionEnabledElement: HTMLSelectElement =
  document.getElementById('enabled-frost-protection') as HTMLSelectElement
const holidayModeEnabledElement: HTMLSelectElement = document.getElementById(
  'enabled-holiday-mode',
) as HTMLSelectElement

let buildingMapping: Record<string, BuildingData> = {}

let errorLogTBodyElement: HTMLTableSectionElement | null = null

let errorCount = 0
let fromDateHuman = ''
let to = ''

const disableButton = (elementId: string, value = true): void => {
  const element: HTMLButtonElement | null = document.getElementById(
    elementId,
  ) as HTMLButtonElement | null
  if (!element) {
    return
  }
  if (value) {
    element.classList.add('is-disabled')
  } else {
    element.classList.remove('is-disabled')
  }
}

const disableButtons = (setting: string, value = true): void => {
  const [baseSetting, suffix]: string[] = setting.split('-')
  ;['apply', 'refresh'].forEach((action: string) => {
    disableButton(`${action}-${setting}`, value)
    if (suffix === 'common') {
      Object.keys(deviceSettings).forEach((driverId: string) => {
        disableButton(`${action}-${baseSetting}-${driverId}`, value)
      })
    } else {
      disableButton(`${action}-${baseSetting}-common`, value)
    }
  })
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
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      '/language',
      (error: Error | null, language: string): void => {
        if (error) {
          reject(error)
          return
        }
        document.documentElement.lang = language
        resolve()
      },
    )
  })

const getHomeySettings = async (homey: Homey): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.get(
      async (error: Error | null, settings: HomeySettingsUI): Promise<void> => {
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
          reject(error)
          return
        }
        homeySettings = settings
        resolve()
      },
    )
  })

const getDeviceSettings = async (homey: Homey): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      '/settings/devices',
      async (error: Error | null, settings: DeviceSettings): Promise<void> => {
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
          reject(error)
          return
        }
        deviceSettings = settings
        resolve()
      },
    )
  })

const getFlatDeviceSettings = (): void => {
  flatDeviceSettings = Object.values(deviceSettings).reduce<DeviceSetting>(
    (flattenedDeviceSettings, settings: DeviceSetting) =>
      Object.entries(settings).reduce<DeviceSetting>(
        (acc, [settingId, settingValues]: [string, ValueOf<Settings>[]]) => {
          if (!(settingId in acc)) {
            acc[settingId] = []
          }
          acc[settingId].push(
            ...settingValues.filter(
              (settingValue: ValueOf<Settings>) =>
                !acc[settingId].includes(settingValue),
            ),
          )
          return acc
        },
        flattenedDeviceSettings,
      ),
    {},
  )
}

const getDriverSettingsAll = async (homey: Homey): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      '/settings/drivers',
      async (
        error: Error | null,
        driverSettings: DriverSetting[],
      ): Promise<void> => {
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
          reject(error)
          return
        }
        driverSettingsAll = driverSettings
        resolve()
      },
    )
  })

const getDriverSettings = (): void => {
  ;({ driverSettingsCommon, driverSettingsDrivers } = driverSettingsAll.reduce<{
    driverSettingsCommon: DriverSetting[]
    driverSettingsDrivers: Record<string, DriverSetting[]>
  }>(
    (acc, setting: DriverSetting) => {
      if (setting.groupId === 'login') {
        return acc
      }
      if (setting.groupId === 'options') {
        if (
          !acc.driverSettingsCommon.some(
            (option: DriverSetting) => option.id === setting.id,
          )
        ) {
          acc.driverSettingsCommon.push(setting)
        }
      } else {
        const { driverId } = setting
        if (!(driverId in acc.driverSettingsDrivers)) {
          acc.driverSettingsDrivers[driverId] = []
        }
        acc.driverSettingsDrivers[driverId].push(setting)
      }
      return acc
    },
    { driverSettingsCommon: [], driverSettingsDrivers: {} },
  ))
}

const createDivElement = (): HTMLDivElement => {
  const divElement: HTMLDivElement = document.createElement('div')
  divElement.classList.add('homey-form-group')
  return divElement
}

const createInputElement = ({
  id,
  placeholder,
  type,
  value,
}: {
  id: string
  placeholder?: string
  type: string
  value?: string
}): HTMLInputElement => {
  const inputElement: HTMLInputElement = document.createElement('input')
  inputElement.classList.add('homey-form-input')
  inputElement.id = id
  inputElement.value = value ?? ''
  inputElement.type = type
  if (typeof placeholder !== 'undefined') {
    inputElement.placeholder = placeholder
  }
  return inputElement
}

const addTextToCheckbox = (
  labelElement: HTMLLabelElement,
  checkboxElement: HTMLInputElement,
  text: string,
): void => {
  const checkmarkSpanElement: HTMLSpanElement = document.createElement('span')
  checkmarkSpanElement.classList.add('homey-form-checkbox-checkmark')
  const textSpanElement: HTMLSpanElement = document.createElement('span')
  textSpanElement.classList.add('homey-form-checkbox-text')
  textSpanElement.innerText = text
  labelElement.appendChild(checkboxElement)
  labelElement.appendChild(checkmarkSpanElement)
  labelElement.appendChild(textSpanElement)
}

const createLabelElement = (
  element: HTMLInputElement | HTMLSelectElement,
  { text }: { text: string },
): HTMLLabelElement => {
  const isCheckbox: boolean = element.type === 'checkbox'
  const labelElement: HTMLLabelElement = document.createElement('label')
  labelElement.classList.add(
    isCheckbox ? 'homey-form-checkbox' : 'homey-form-label',
  )
  labelElement.htmlFor = element.id
  if (isCheckbox) {
    addTextToCheckbox(labelElement, element as HTMLInputElement, text)
  } else {
    labelElement.innerText = text
  }
  return labelElement
}

const updateCredentialElement = (
  credentialKey: keyof LoginCredentials,
): HTMLInputElement | null => {
  const driverSetting: LoginDriverSetting | undefined = driverSettingsAll.find(
    (setting): setting is LoginDriverSetting => setting.id === credentialKey,
  )
  if (driverSetting) {
    const divElement: HTMLDivElement = createDivElement()
    const inputElement: HTMLInputElement = createInputElement({
      id: driverSetting.id,
      placeholder: driverSetting.placeholder,
      type: driverSetting.type,
      value: homeySettings[driverSetting.id],
    })
    const labelElement: HTMLLabelElement = createLabelElement(inputElement, {
      text: driverSetting.title,
    })
    divElement.appendChild(labelElement)
    divElement.appendChild(inputElement)
    loginElement.appendChild(divElement)
    return inputElement
  }
  return null
}

const credentialKeys: (keyof LoginCredentials)[] = ['username', 'password']

const updateCredentialElements = (): void => {
  ;[usernameElement, passwordElement] = credentialKeys.map(
    updateCredentialElement,
  )
}

const int = (
  homey: Homey,
  element: HTMLInputElement,
  value: number = Number.parseInt(element.value, 10),
): number => {
  if (
    Number.isNaN(value) ||
    value < Number(element.min) ||
    value > Number(element.max)
  ) {
    element.value = ''
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

const processSettingValue = (
  homey: Homey,
  element: HTMLInputElement | HTMLSelectElement,
): ValueOf<Settings> => {
  if (element.value) {
    const intValue: number = Number.parseInt(element.value, 10)
    if (!Number.isNaN(intValue)) {
      return element instanceof HTMLInputElement
        ? int(homey, element, intValue)
        : intValue
    }
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      if (!element.indeterminate) {
        return element.checked
      }
      return null
    }
    return ['true', 'false'].includes(element.value)
      ? element.value === 'true'
      : element.value
  }
  return null
}

const shouldUpdate = (
  settingId: string,
  settingValue: ValueOf<Settings>,
  driverId?: string,
): boolean => {
  if (settingValue === null) {
    return false
  }
  const deviceSetting: ValueOf<Settings>[] | undefined =
    typeof driverId === 'undefined'
      ? flatDeviceSettings[settingId]
      : (deviceSettings[driverId] as DeviceSetting | undefined)?.[settingId]
  return (
    typeof deviceSetting !== 'undefined' &&
    (new Set(deviceSetting).size !== 1 || settingValue !== deviceSetting[0])
  )
}

const buildSettingsBody = (
  homey: Homey,
  elements: (HTMLInputElement | HTMLSelectElement)[],
  driverId?: string,
): Settings =>
  Object.fromEntries(
    elements
      .map(
        (
          element: HTMLInputElement | HTMLSelectElement,
        ): [null] | [string, ValueOf<Settings>] => {
          const [settingId]: string[] = element.id.split('--')
          const settingValue: ValueOf<Settings> = processSettingValue(
            homey,
            element,
          )
          return shouldUpdate(settingId, settingValue, driverId)
            ? [settingId, settingValue]
            : [null]
        },
      )
      .filter(
        (
          entry: [null] | [string, ValueOf<Settings>],
        ): entry is [string, ValueOf<Settings>] => entry[0] !== null,
      ),
  )

const generateErrorLogTable = (
  homey: Homey,
  keys: string[],
): HTMLTableSectionElement => {
  const tableElement: HTMLTableElement = document.createElement('table')
  tableElement.classList.add('bordered')
  tableElement.setAttribute('aria-describedby', 'Error Log')
  const theadElement: HTMLTableSectionElement = tableElement.createTHead()
  const rowElement: HTMLTableRowElement = theadElement.insertRow()
  keys.forEach((key: string) => {
    const thElement: HTMLTableCellElement = document.createElement('th')
    thElement.innerText = homey.__(`settings.error_log.columns.${key}`)
    rowElement.appendChild(thElement)
  })
  errorLogElement.appendChild(tableElement)
  return tableElement.createTBody()
}

const generateErrorLogTableData = (
  homey: Homey,
  errors: ErrorDetails[],
): void => {
  if (!errors.length) {
    return
  }
  errors.forEach((error: ErrorDetails) => {
    if (!errorLogTBodyElement) {
      errorLogTBodyElement = generateErrorLogTable(
        homey,
        Object.keys(errors[0]),
      )
    }
    const rowElement: HTMLTableRowElement = errorLogTBodyElement.insertRow()
    Object.values(error).forEach((value: string) => {
      const cellElement: HTMLTableCellElement = rowElement.insertCell()
      cellElement.innerText = value
    })
  })
}

const getErrorCountText = (homey: Homey, count: number): string => {
  switch (true) {
    case count <= 1:
      return homey.__(`settings.error_log.error_count.${count}`)
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    case [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100):
      return homey.__('settings.error_log.error_count.234')
    default:
      return homey.__('settings.error_log.error_count.plural')
  }
}

const updateErrorLogElements = (homey: Homey, data: ErrorLog): void => {
  ;({ fromDateHuman } = data)
  periodLabelElement.innerText = homey.__('settings.error_log.period', {
    fromDateHuman,
  })
  sinceElement.value = data.nextFromDate
  to = data.nextToDate
  errorCount += data.errors.length
  errorCountLabelElement.innerText = `${errorCount} ${getErrorCountText(homey, errorCount)}`
}

const generateErrorLog = (homey: Homey): void => {
  const query: ErrorLogQuery = {
    from: sinceElement.value,
    limit: '29',
    offset: '0',
    to,
  }
  const queryString: string = new URLSearchParams(
    query as Record<string, string>,
  ).toString()
  // @ts-expect-error: `homey` is partially typed
  homey.api(
    'GET',
    `/error_log?${queryString}`,
    async (error: Error | null, data: ErrorLog): Promise<void> => {
      seeElement.classList.remove('is-disabled')
      if (error) {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
        return
      }
      updateErrorLogElements(homey, data)
      generateErrorLogTableData(homey, data.errors)
    },
  )
}

const refreshBuildingHolidayModeSettings = (data: HolidayModeData): void => {
  const {
    HMEnabled: enabled,
    HMEndDate: endDate,
    HMStartDate: startDate,
  } = data
  holidayModeEnabledElement.value = String(enabled)
  holidayModeEndDateElement.value = enabled ? endDate ?? '' : ''
  holidayModeStartDateElement.value = enabled ? startDate ?? '' : ''
}

const refreshBuildingFrostProtectionSettings = (
  data: FrostProtectionData,
): void => {
  const {
    FPEnabled: enabled,
    FPMaxTemperature: max,
    FPMinTemperature: min,
  } = data
  frostProtectionEnabledElement.value = String(enabled)
  frostProtectionMaxTemperatureElement.value = String(max)
  frostProtectionMinTemperatureElement.value = String(min)
}

const refreshBuildingSettings = (): void => {
  const settings: BuildingData = buildingMapping[buildingElement.value]
  refreshBuildingHolidayModeSettings(settings)
  refreshBuildingFrostProtectionSettings(settings)
}

const updateBuildingMapping = (
  data: FrostProtectionData | HolidayModeData,
): void => {
  buildingMapping[buildingElement.value] = {
    ...buildingMapping[buildingElement.value],
    ...data,
  }
}

const getBuildingHolidayModeSettings = async (
  homey: Homey,
  raise = false,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      `/settings/buildings/${buildingElement.value}/holiday_mode`,
      async (error: Error | null, data: HolidayModeData): Promise<void> => {
        enableButtons('holiday-mode')
        if (error) {
          if (raise) {
            reject(new Error(error.message))
          } else {
            // @ts-expect-error: `homey` is partially typed
            await homey.alert(error.message)
            resolve()
          }
          return
        }
        updateBuildingMapping(data)
        refreshBuildingHolidayModeSettings(data)
        resolve()
      },
    )
  })

const getBuildingFrostProtectionSettings = async (
  homey: Homey,
  raise = false,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      `/settings/buildings/${buildingElement.value}/frost_protection`,
      async (error: Error | null, data: FrostProtectionData): Promise<void> => {
        enableButtons('frost-protection')
        if (error) {
          if (raise) {
            reject(new Error(error.message))
          } else {
            // @ts-expect-error: `homey` is partially typed
            await homey.alert(error.message)
            resolve()
          }
          return
        }
        updateBuildingMapping(data)
        refreshBuildingFrostProtectionSettings(data)
        resolve()
      },
    )
  })

const getBuildings = async (
  homey: Homey,
): Promise<Record<string, BuildingData>> =>
  new Promise<Record<string, BuildingData>>((resolve, reject) => {
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'GET',
      '/buildings',
      async (error: Error | null, buildings: Building[]): Promise<void> => {
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
          reject(error)
          return
        }
        buildingMapping = Object.fromEntries(
          buildings.map((building: Building): [string, BuildingData] => {
            const {
              ID,
              Name: name,
              FPEnabled: fpEnabled,
              FPMaxTemperature: fpMax,
              FPMinTemperature: fpMin,
              HMEnabled: hmEnabled,
              HMEndDate: hmEndDate,
              HMStartDate: hmStartDate,
            } = building
            const optionElement: HTMLOptionElement =
              document.createElement('option')
            optionElement.value = String(ID)
            optionElement.innerText = name
            buildingElement.appendChild(optionElement)
            return [
              String(ID),
              {
                FPEnabled: fpEnabled,
                FPMaxTemperature: fpMax,
                FPMinTemperature: fpMin,
                HMEnabled: hmEnabled,
                HMEndDate: hmEndDate,
                HMStartDate: hmStartDate,
              },
            ]
          }),
        )
        resolve(buildingMapping)
      },
    )
  })

const updateDeviceSettings = (body: Settings, driverId?: string): void => {
  if (typeof driverId === 'undefined') {
    Object.entries(body).forEach(
      ([settingId, settingValue]: [string, ValueOf<Settings>]) => {
        Object.keys(deviceSettings).forEach((driver: string) => {
          deviceSettings[driver][settingId] = [settingValue]
        })
        flatDeviceSettings[settingId] = [settingValue]
      },
    )
  } else {
    Object.entries(body).forEach(
      ([settingId, settingValue]: [string, ValueOf<Settings>]) => {
        deviceSettings[driverId][settingId] = [settingValue]
      },
    )
    getFlatDeviceSettings()
  }
}

const setDeviceSettings = (
  homey: Homey,
  body: Settings,
  driverId?: string,
): void => {
  let endPoint = '/settings/devices'
  if (typeof driverId !== 'undefined') {
    const queryString: string = new URLSearchParams({ driverId }).toString()
    endPoint += `?${queryString}`
  }
  // @ts-expect-error: `homey` is partially typed
  homey.api(
    'PUT',
    endPoint,
    body,
    async (error: Error | null): Promise<void> => {
      if (error) {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
        return
      }
      updateDeviceSettings(body, driverId)
      enableButtons(`settings-${driverId ?? 'common'}`)
      // @ts-expect-error: `homey` is partially typed
      await homey.alert(homey.__('settings.success'))
    },
  )
}

const addApplySettingsEventListener = (
  homey: Homey,
  elements: (HTMLInputElement | HTMLSelectElement)[],
  driverId?: string,
): void => {
  const settings = `settings-${driverId ?? 'common'}`
  const buttonElement: HTMLButtonElement = document.getElementById(
    `apply-${settings}`,
  ) as HTMLButtonElement
  buttonElement.addEventListener('click', (): void => {
    let body: Settings = {}
    try {
      body = buildSettingsBody(homey, elements, driverId)
    } catch (error: unknown) {
      // @ts-expect-error: `homey` is partially typed
      homey.alert(error instanceof Error ? error.message : String(error))
      return
    }
    if (!Object.keys(body).length) {
      // @ts-expect-error: `homey` is partially typed
      homey.alert(homey.__('settings.devices.apply.nothing'))
      return
    }
    // @ts-expect-error: `homey` is partially typed
    homey.confirm(
      homey.__('settings.devices.apply.confirm'),
      null,
      async (error: Error | null, ok: boolean): Promise<void> => {
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
          return
        }
        if (ok) {
          disableButtons(settings)
          setDeviceSettings(homey, body, driverId)
        }
      },
    )
  })
}

const updateCommonChildrenElement = (element: HTMLSelectElement): void => {
  const values: ValueOf<Settings>[] | undefined = flatDeviceSettings[
    element.id.split('--')[0]
  ] as ValueOf<Settings>[] | undefined
  element.value = values && new Set(values).size === 1 ? String(values[0]) : ''
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
  const values: boolean[] = deviceSettings[driverId][
    element.id.split('--')[0]
  ] as boolean[]

  if (new Set(values).size === 1) {
    ;[element.checked] = values
  } else {
    element.indeterminate = true
    element.addEventListener('change', (): void => {
      if (element.indeterminate) {
        element.indeterminate = false
      }
    })
  }
}

const addRefreshSettingsDriverEventListener = (
  elements: HTMLInputElement[],
  driverId: string,
): void => {
  elements.forEach((element: HTMLInputElement) => {
    updateCheckboxChildrenElement(element, driverId)
  })
}

const addRefreshSettingsEventListener = (
  elements: (HTMLInputElement | HTMLSelectElement)[],
  driverId?: string,
): void => {
  const settings = `settings-${driverId ?? 'common'}`
  const buttonElement: HTMLButtonElement = document.getElementById(
    `refresh-${settings}`,
  ) as HTMLButtonElement
  buttonElement.addEventListener('click', (): void => {
    disableButtons(settings)
    if (typeof driverId === 'undefined') {
      addRefreshSettingsCommonEventListener(elements as HTMLSelectElement[])
    } else {
      addRefreshSettingsDriverEventListener(
        elements as HTMLInputElement[],
        driverId,
      )
    }
    enableButtons(settings)
  })
}

const addSettingsEventListeners = (
  homey: Homey,
  elements: (HTMLInputElement | HTMLSelectElement)[],
  driverId?: string,
): void => {
  addApplySettingsEventListener(homey, elements, driverId)
  addRefreshSettingsEventListener(elements, driverId)
}

const createSelectElement = (
  homey: Homey,
  setting: DriverSetting,
): HTMLSelectElement => {
  const selectElement: HTMLSelectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
  selectElement.id = `${setting.id}--setting`
  ;[
    { id: '' },
    ...(setting.type === 'checkbox'
      ? [{ id: 'false' }, { id: 'true' }]
      : setting.values ?? []),
  ].forEach(({ id, label }: { id: string; label?: string }) => {
    const optionElement: HTMLOptionElement = document.createElement('option')
    optionElement.value = id
    if (id) {
      optionElement.innerText = label ?? homey.__(`settings.boolean.${id}`)
    }
    selectElement.appendChild(optionElement)
  })
  updateCommonChildrenElement(selectElement)
  return selectElement
}

const generateCommonChildrenElements = (homey: Homey): void => {
  driverSettingsCommon
    .filter((setting: DriverSetting) =>
      ['checkbox', 'dropdown'].includes(setting.type),
    )
    .forEach((setting: DriverSetting) => {
      const divElement: HTMLDivElement = createDivElement()
      const selectElement: HTMLSelectElement = createSelectElement(
        homey,
        setting,
      )
      const labelElement: HTMLLabelElement = createLabelElement(selectElement, {
        text: setting.title,
      })
      divElement.appendChild(labelElement)
      divElement.appendChild(selectElement)
      settingsCommonElement.appendChild(divElement)
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
  const legendElement: HTMLLegendElement = document.createElement('legend')
  legendElement.classList.add('homey-form-checkbox-set-title')
  if (typeof text !== 'undefined') {
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
  const settingsElement: HTMLDivElement | null = document.getElementById(
    `settings-${driverId}`,
  ) as HTMLDivElement | null
  if (!settingsElement) {
    return
  }
  const fieldSetElement: HTMLFieldSetElement =
    document.createElement('fieldset')
  fieldSetElement.classList.add('homey-form-checkbox-set')
  let previousGroupLabel: string | undefined = ''
  driverSettingsDrivers[driverId]
    .filter((setting: DriverSetting) => setting.type === 'checkbox')
    .forEach((setting: DriverSetting) => {
      if (setting.groupLabel !== previousGroupLabel) {
        previousGroupLabel = setting.groupLabel
        const legendElement: HTMLLegendElement = createLegendElement({
          text: setting.groupLabel,
        })
        fieldSetElement.appendChild(legendElement)
      }
      const checkboxElement: HTMLInputElement = createCheckboxElement(
        { id: setting.id },
        driverId,
      )
      const labelElement: HTMLLabelElement = createLabelElement(
        checkboxElement,
        { text: setting.title },
      )
      fieldSetElement.appendChild(labelElement)
    })
  settingsElement.appendChild(fieldSetElement)
  addSettingsEventListeners(
    homey,
    Array.from(fieldSetElement.querySelectorAll('input')),
    driverId,
  )
  unhide(document.getElementById(`has-devices-${driverId}`) as HTMLDivElement)
}

const generate = async (homey: Homey): Promise<void> => {
  buildingMapping = await getBuildings(homey)
  if (!Object.keys(buildingMapping).length) {
    seeElement.classList.add('is-disabled')
    disableButtons('frost-protection')
    disableButtons('holiday-mode')
    disableButtons('settings-common')
    // @ts-expect-error: `homey` is partially typed
    await homey.alert(homey.__('settings.devices.none'))
    return
  }
  refreshBuildingSettings()
  generateErrorLog(homey)
}

const needsAuthentication = (value = true): void => {
  if (!loginElement.childElementCount) {
    updateCredentialElements()
  }
  hide(authenticatedElement, value)
  unhide(authenticatingElement, value)
}

const login = async (homey: Homey): Promise<void> => {
  const username: string = usernameElement?.value ?? ''
  const password: string = passwordElement?.value ?? ''
  if (!username || !password) {
    // @ts-expect-error: `homey` is partially typed
    await homey.alert(homey.__('settings.authenticate.failure'))
    return
  }
  const body: LoginCredentials = { password, username }
  // @ts-expect-error: `homey` is partially typed
  homey.api(
    'POST',
    '/sessions',
    body,
    async (error: Error | null, loggedIn: boolean): Promise<void> => {
      if (error) {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
        return
      }
      if (!loggedIn) {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(homey.__('settings.authenticate.failure'))
        return
      }
      await generate(homey)
      needsAuthentication(false)
    },
  )
}

const addHolidayModeEventListeners = (homey: Homey): void => {
  holidayModeEnabledElement.addEventListener('change', (): void => {
    if (holidayModeEnabledElement.value === 'false') {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })

  holidayModeStartDateElement.addEventListener('change', (): void => {
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

  holidayModeEndDateElement.addEventListener('change', (): void => {
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

  refreshHolidayModeElement.addEventListener('click', (): void => {
    disableButtons('holiday-mode')
    getBuildingHolidayModeSettings(homey).catch(
      async (error: Error): Promise<void> => {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
      },
    )
  })
}

const addUpdateHolidayModeEventListener = (homey: Homey): void => {
  updateHolidayModeElement.addEventListener('click', (): void => {
    disableButtons('holiday-mode')
    const data: HolidayModeData = buildingMapping[buildingElement.value]
    const enabled: boolean = holidayModeEnabledElement.value === 'true'
    const body: HolidayModeSettings = {
      Enabled: enabled,
      EndDate: enabled ? holidayModeEndDateElement.value : '',
      StartDate: enabled ? holidayModeStartDateElement.value : '',
    }
    // @ts-expect-error: `homey` is partially typed
    homey.api(
      'PUT',
      `/settings/buildings/${buildingElement.value}/holiday_mode`,
      body,
      async (error: Error | null): Promise<void> => {
        enableButtons('holiday-mode')
        try {
          await getBuildingHolidayModeSettings(homey, true)
        } catch (err: unknown) {
          refreshBuildingHolidayModeSettings(data)
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(err.message)
          return
        }
        if (error) {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(error.message)
        } else {
          // @ts-expect-error: `homey` is partially typed
          await homey.alert(homey.__('settings.success'))
        }
      },
    )
  })
}

const addFrostProtectionEventListeners = (homey: Homey): void => {
  frostProtectionMinTemperatureElement.addEventListener('change', (): void => {
    if (frostProtectionEnabledElement.value === 'false') {
      frostProtectionEnabledElement.value = 'true'
    }
  })

  frostProtectionMaxTemperatureElement.addEventListener('change', (): void => {
    if (frostProtectionEnabledElement.value === 'false') {
      frostProtectionEnabledElement.value = 'true'
    }
  })

  refreshFrostProtectionElement.addEventListener('click', (): void => {
    disableButtons('frost-protection')
    getBuildingFrostProtectionSettings(homey).catch(
      async (error: Error): Promise<void> => {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
      },
    )
  })
}

const updateFrostProtectionData = (
  homey: Homey,
  body: FrostProtectionSettings,
  data: FrostProtectionData,
): void => {
  // @ts-expect-error: `homey` is partially typed
  homey.api(
    'PUT',
    `/settings/buildings/${buildingElement.value}/frost_protection`,
    body,
    async (error: Error | null): Promise<void> => {
      enableButtons('frost-protection')
      try {
        await getBuildingFrostProtectionSettings(homey, true)
      } catch (err: unknown) {
        refreshBuildingFrostProtectionSettings(data)
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(err.message)
        return
      }
      if (error) {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
      } else {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(homey.__('settings.success'))
      }
    },
  )
}

const fixAndGetFpMinMax = (homey: Homey): [number, number] => {
  let [min, max]: [number, number] = [
    int(homey, frostProtectionMinTemperatureElement),
    int(homey, frostProtectionMaxTemperatureElement),
  ]
  if (min > max) {
    ;[min, max] = [max, min]
  }
  if (max - min < FP_MIN_MAX_GAP) {
    max = min + FP_MIN_MAX_GAP
  }
  if (frostProtectionMinTemperatureElement.value !== String(min)) {
    frostProtectionMinTemperatureElement.value = String(min)
    frostProtectionMaxTemperatureElement.value = String(max)
  }
  return [min, max]
}

const addUpdateFrostProtectionEventListener = (homey: Homey): void => {
  updateFrostProtectionElement.addEventListener('click', (): void => {
    disableButtons('frost-protection')
    const data: FrostProtectionData = buildingMapping[buildingElement.value]
    try {
      const [min, max]: [number, number] = fixAndGetFpMinMax(homey)
      updateFrostProtectionData(
        homey,
        {
          Enabled: frostProtectionEnabledElement.value === 'true',
          MaximumTemperature: max,
          MinimumTemperature: min,
        },
        data,
      )
    } catch (error: unknown) {
      refreshBuildingFrostProtectionSettings(data)
      enableButtons('frost-protection')
      // @ts-expect-error: `homey` is partially typed
      homey.alert(error instanceof Error ? error.message : String(error))
    }
  })
}

const addEventListeners = (homey: Homey): void => {
  authenticateElement.addEventListener('click', (): void => {
    authenticateElement.classList.add('is-disabled')
    login(homey)
      .catch(async (error: Error): Promise<void> => {
        // @ts-expect-error: `homey` is partially typed
        await homey.alert(error.message)
      })
      .finally((): void => {
        authenticateElement.classList.remove('is-disabled')
      })
  })

  sinceElement.addEventListener('change', (): void => {
    if (
      to &&
      sinceElement.value &&
      Date.parse(sinceElement.value) > Date.parse(to)
    ) {
      sinceElement.value = to
      // @ts-expect-error: `homey` is partially typed
      homey.alert(homey.__('settings.error_log.error', { fromDateHuman }))
    }
  })

  seeElement.addEventListener('click', (): void => {
    seeElement.classList.add('is-disabled')
    generateErrorLog(homey)
  })

  autoAdjustElement.addEventListener('click', (): void => {
    // @ts-expect-error: `homey` is partially typed
    homey.openURL('https://homey.app/a/com.mecloud.extension')
  })

  buildingElement.addEventListener('change', refreshBuildingSettings)

  addHolidayModeEventListeners(homey)
  addUpdateHolidayModeEventListener(homey)
  addFrostProtectionEventListeners(homey)
  addUpdateFrostProtectionEventListener(homey)
}

const load = async (homey: Homey): Promise<void> => {
  addEventListeners(homey)
  generateCommonChildrenElements(homey)
  if (typeof homeySettings.contextKey !== 'undefined') {
    Object.keys(deviceSettings).forEach((driverId: string) => {
      generateCheckboxChildrenElements(homey, driverId)
    })
    try {
      await generate(homey)
      return
    } catch (error: unknown) {
      // Pass
    }
  }
  needsAuthentication()
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  await homey.ready()
  await setDocumentLanguage(homey)
  await getHomeySettings(homey)
  await getDeviceSettings(homey)
  getFlatDeviceSettings()
  await getDriverSettingsAll(homey)
  getDriverSettings()
  await load(homey)
}
