/* eslint-disable @typescript-eslint/no-unsafe-call */
import type Homey from 'homey/lib/Homey'
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
  HomeySettings,
  LoginCredentials,
  LoginDriverSetting,
  Settings,
  SettingValue,
} from '../types'

async function onHomeyReady(homey: Homey): Promise<void> {
  await homey.ready()

  await new Promise<void>((resolve, reject) => {
    // @ts-expect-error: homey is partially typed
    homey.api(
      'GET',
      '/language',
      (error: Error | null, language: string): void => {
        if (error !== null) {
          reject(error)
          return
        }
        document.documentElement.lang = language
        resolve()
      }
    )
  })

  const homeySettings: Partial<HomeySettings> = await new Promise<
    Partial<HomeySettings>
  >((resolve, reject) => {
    // @ts-expect-error: homey is partially typed
    homey.get(
      async (
        error: Error | null,
        settings: Partial<HomeySettings>
      ): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          reject(error)
          return
        }
        resolve(settings)
      }
    )
  })

  const deviceSettings: DeviceSettings = await new Promise<DeviceSettings>(
    (resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        '/devices/settings',
        async (
          error: Error | null,
          settings: DeviceSettings
        ): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            reject(error)
            return
          }
          resolve(settings)
        }
      )
    }
  )

  function flattenDeviceSettings(): DeviceSetting {
    return Object.values(deviceSettings).reduce<DeviceSetting>(
      (flattenedDeviceSettings, settings: DeviceSetting) =>
        Object.entries(settings).reduce<DeviceSetting>(
          (acc, [settingId, settingValues]: [string, SettingValue[]]) => {
            if (!(settingId in acc)) {
              acc[settingId] = []
            }
            acc[settingId].push(
              ...settingValues.filter(
                (settingValue: SettingValue) =>
                  !acc[settingId].includes(settingValue)
              )
            )
            return acc
          },
          flattenedDeviceSettings
        ),
      {}
    )
  }

  let flatDeviceSettings: DeviceSetting = flattenDeviceSettings()

  const driverSettingsAll: DriverSetting[] = await new Promise<DriverSetting[]>(
    (resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        '/drivers/settings',
        async (
          error: Error | null,
          driverSettings: DriverSetting[]
        ): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            reject(error)
            return
          }
          resolve(driverSettings)
        }
      )
    }
  )

  const { driverSettingsCommon, driverSettings } = driverSettingsAll.reduce<{
    driverSettings: Record<string, DriverSetting[]>
    driverSettingsCommon: DriverSetting[]
  }>(
    (acc, setting: DriverSetting) => {
      if (setting.groupId === 'login') {
        return acc
      }
      if (setting.groupId === 'options') {
        if (
          !acc.driverSettingsCommon.some(
            (option: DriverSetting) => option.id === setting.id
          )
        ) {
          acc.driverSettingsCommon.push(setting)
        }
      } else {
        const { driverId } = setting
        if (!(driverId in acc.driverSettings)) {
          acc.driverSettings[driverId] = []
        }
        acc.driverSettings[driverId].push(setting)
      }
      return acc
    },
    {
      driverSettingsCommon: [],
      driverSettings: {},
    }
  )

  const intMinValueMap = new WeakMap<HTMLInputElement, number>()
  const intMaxValueMap = new WeakMap<HTMLInputElement, number>()

  const minMinTemperature = 4
  const maxMinTemperature = 14
  const minMaxTemperature = 6
  const maxMaxTemperature = 16

  const authenticateElement: HTMLButtonElement = document.getElementById(
    'authenticate'
  ) as HTMLButtonElement
  const autoAdjustElement: HTMLButtonElement = document.getElementById(
    'auto_adjust'
  ) as HTMLButtonElement
  const refreshFrostProtectionElement: HTMLButtonElement =
    document.getElementById('refresh-frost-protection') as HTMLButtonElement
  const refreshHolidayModeElement: HTMLButtonElement = document.getElementById(
    'refresh-holiday-mode'
  ) as HTMLButtonElement
  const seeElement: HTMLButtonElement = document.getElementById(
    'see'
  ) as HTMLButtonElement
  const updateFrostProtectionElement: HTMLButtonElement =
    document.getElementById('apply-frost-protection') as HTMLButtonElement
  const updateHolidayModeElement: HTMLButtonElement = document.getElementById(
    'apply-holiday-mode'
  ) as HTMLButtonElement

  const authenticatedElement: HTMLDivElement = document.getElementById(
    'authenticated'
  ) as HTMLDivElement
  const authenticatingElement: HTMLDivElement = document.getElementById(
    'authenticating'
  ) as HTMLDivElement
  const errorLogElement: HTMLDivElement = document.getElementById(
    'error-log'
  ) as HTMLDivElement
  const loginElement: HTMLDivElement = document.getElementById(
    'login'
  ) as HTMLDivElement
  const settingsCommonElement: HTMLDivElement = document.getElementById(
    'settings-common'
  ) as HTMLDivElement

  const sinceElement: HTMLInputElement = document.getElementById(
    'since'
  ) as HTMLInputElement
  const frostProtectionMinimumTemperatureElement: HTMLInputElement =
    document.getElementById('min') as HTMLInputElement
  frostProtectionMinimumTemperatureElement.min = String(minMinTemperature)
  frostProtectionMinimumTemperatureElement.max = String(maxMinTemperature)
  const frostProtectionMaximumTemperatureElement: HTMLInputElement =
    document.getElementById('max') as HTMLInputElement
  frostProtectionMaximumTemperatureElement.min = String(minMaxTemperature)
  frostProtectionMaximumTemperatureElement.max = String(maxMaxTemperature)
  const holidayModeStartDateElement: HTMLInputElement = document.getElementById(
    'start-date'
  ) as HTMLInputElement
  const holidayModeEndDateElement: HTMLInputElement = document.getElementById(
    'end-date'
  ) as HTMLInputElement

  const errorCountLabelElement: HTMLLabelElement = document.getElementById(
    'error_count'
  ) as HTMLLabelElement
  const periodLabelElement: HTMLLabelElement = document.getElementById(
    'period'
  ) as HTMLLabelElement

  const buildingElement: HTMLSelectElement = document.getElementById(
    'buildings'
  ) as HTMLSelectElement
  const frostProtectionEnabledElement: HTMLSelectElement =
    document.getElementById('enabled-frost-protection') as HTMLSelectElement
  const holidayModeEnabledElement: HTMLSelectElement = document.getElementById(
    'enabled-holiday-mode'
  ) as HTMLSelectElement

  let usernameElement: HTMLInputElement | null = document.getElementById(
    'username'
  ) as HTMLInputElement | null
  let passwordElement: HTMLInputElement | null = document.getElementById(
    'password'
  ) as HTMLInputElement | null

  let buildingMapping: Record<string, BuildingData> = {}

  let errorLogTBodyElement: HTMLTableSectionElement | null = null

  let errorCount = 0
  let fromDateHuman = ''
  let to = ''

  function disableButtons(setting: string, value = true): void {
    ;['apply', 'refresh'].forEach((action: string): void => {
      const element: HTMLButtonElement | null = document.getElementById(
        `${action}-${setting}`
      ) as HTMLButtonElement | null
      if (element === null) {
        return
      }
      if (value) {
        element.classList.add('is-disabled')
      } else {
        element.classList.remove('is-disabled')
      }
    })
  }

  function enableButtons(setting: string, value = true): void {
    disableButtons(setting, !value)
  }

  function hide(element: HTMLDivElement, value = true): void {
    element.classList.toggle('hidden', value)
  }

  function unhide(element: HTMLDivElement, value = true): void {
    hide(element, !value)
  }

  function generateErrorLogTable(keys: string[]): HTMLTableSectionElement {
    const tableElement: HTMLTableElement = document.createElement('table')
    tableElement.className = 'bordered'
    tableElement.setAttribute('aria-describedby', 'Error Log')
    const theadElement: HTMLTableSectionElement = tableElement.createTHead()
    const rowElement: HTMLTableRowElement = theadElement.insertRow()
    keys.forEach((key: string): void => {
      const thElement: HTMLTableCellElement = document.createElement('th')
      thElement.innerText = homey.__(`settings.error_log.columns.${key}`)
      rowElement.appendChild(thElement)
    })
    errorLogElement.appendChild(tableElement)
    return tableElement.createTBody()
  }

  function generateErrorLogTableData(errors: ErrorDetails[]): void {
    if (errors.length === 0) {
      return
    }
    errors.forEach((error: ErrorDetails): void => {
      if (errorLogTBodyElement === null) {
        errorLogTBodyElement = generateErrorLogTable(Object.keys(errors[0]))
      }
      const rowElement: HTMLTableRowElement = errorLogTBodyElement.insertRow()
      Object.values(error).forEach((value: string): void => {
        const cellElement: HTMLTableCellElement = rowElement.insertCell()
        cellElement.innerText = value
      })
    })
  }

  function getErrorCountText(count: number): string {
    if (count === 0) {
      return homey.__('settings.error_log.error_count.0')
    }
    if (count === 1) {
      return homey.__('settings.error_log.error_count.1')
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return homey.__('settings.error_log.error_count.234')
    }
    return homey.__('settings.error_log.error_count.plural')
  }

  function generateErrorLog(): void {
    const query: ErrorLogQuery = {
      from: sinceElement.value,
      to,
      limit: '29',
      offset: '0',
    }
    const queryString: string = new URLSearchParams(
      query as Record<string, string>
    ).toString()
    // @ts-expect-error: homey is partially typed
    homey.api(
      'GET',
      `/error_log?${queryString}`,
      async (error: Error | null, data: ErrorLog): Promise<void> => {
        seeElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        fromDateHuman = data.FromDateHuman
        periodLabelElement.innerText = homey.__('settings.error_log.period', {
          fromDateHuman,
        })
        sinceElement.value = data.NextFromDate
        to = data.NextToDate

        errorCount += data.Errors.length
        errorCountLabelElement.innerText = `${errorCount} ${getErrorCountText(
          errorCount
        )}`
        generateErrorLogTableData(data.Errors)
      }
    )
  }

  function int(
    element: HTMLInputElement,
    value: number = Number.parseInt(element.value, 10)
  ): number {
    let minValue = intMinValueMap.get(element)
    let maxValue = intMaxValueMap.get(element)
    if (minValue === undefined || maxValue === undefined) {
      minValue = Number(element.min)
      maxValue = Number(element.max)
      intMinValueMap.set(element, minValue)
      intMaxValueMap.set(element, maxValue)
    }
    if (Number.isNaN(value) || value < minValue || value > maxValue) {
      element.value = '' // eslint-disable-line no-param-reassign
      const labelElement: HTMLLabelElement | null = document.querySelector(
        `label[for="${element.id}"]`
      )
      throw new Error(
        homey.__('settings.int_error', {
          name: homey.__(labelElement?.innerText ?? ''),
          min: minValue,
          max: maxValue,
        })
      )
    }
    return value
  }

  function processSettingValue(
    element: HTMLInputElement | HTMLSelectElement
  ): SettingValue {
    const { value } = element
    if (value === '') {
      return null
    }
    const intValue: number = Number.parseInt(value, 10)
    if (!Number.isNaN(intValue)) {
      return element instanceof HTMLInputElement
        ? int(element, intValue)
        : intValue
    }
    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      if (!element.indeterminate) {
        return element.checked
      }
      return null
    }
    return ['true', 'false'].includes(value) ? value === 'true' : value
  }

  function buildSettingsBody(
    elements: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ): Settings {
    const shouldUpdate = (
      settingId: string,
      settingValue: SettingValue
    ): boolean => {
      if (settingValue !== null) {
        const deviceSetting: SettingValue[] | undefined =
          driverId !== undefined
            ? (deviceSettings[driverId] as DeviceSetting | undefined)?.[
                settingId
              ]
            : flatDeviceSettings[settingId]
        return (
          deviceSetting !== undefined &&
          (deviceSetting.length !== 1 || settingValue !== deviceSetting[0])
        )
      }
      return false
    }

    return Object.fromEntries(
      elements
        .map(
          (
            element: HTMLInputElement | HTMLSelectElement
          ): [string, SettingValue] | [null] => {
            const settingId: string = element.id.split('--')[0]
            const settingValue: SettingValue = processSettingValue(element)
            return shouldUpdate(settingId, settingValue)
              ? [settingId, settingValue]
              : [null]
          }
        )
        .filter(
          (
            entry: [string, SettingValue] | [null]
          ): entry is [string, SettingValue] => entry[0] !== null
        )
    )
  }

  function updateBuildingMapping(
    data: FrostProtectionData | HolidayModeData
  ): void {
    buildingMapping[buildingElement.value] = {
      ...buildingMapping[buildingElement.value],
      ...data,
    }
  }

  function refreshBuildingHolidayModeSettings(settings: HolidayModeData): void {
    const { HMEnabled, HMStartDate, HMEndDate } = settings
    holidayModeEnabledElement.value = String(HMEnabled)
    holidayModeStartDateElement.value = HMEnabled ? HMStartDate ?? '' : ''
    holidayModeEndDateElement.value = HMEnabled ? HMEndDate ?? '' : ''
  }

  async function getBuildingHolidayModeSettings(raise = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        `/buildings/${buildingElement.value}/settings/holiday_mode`,
        async (error: Error | null, data: HolidayModeData): Promise<void> => {
          enableButtons('holiday-mode')
          if (error !== null) {
            if (raise) {
              reject(new Error(error.message))
              return
            }
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            resolve()
            return
          }
          updateBuildingMapping(data)
          refreshBuildingHolidayModeSettings(data)
          resolve()
        }
      )
    })
  }

  function refreshBuildingFrostProtectionSettings(
    settings: FrostProtectionData
  ): void {
    const { FPEnabled, FPMinTemperature, FPMaxTemperature } = settings
    frostProtectionEnabledElement.value = String(FPEnabled)
    frostProtectionMinimumTemperatureElement.value = String(FPMinTemperature)
    frostProtectionMaximumTemperatureElement.value = String(FPMaxTemperature)
  }

  async function getBuildingFrostProtectionSettings(
    raise = false
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        `/buildings/${buildingElement.value}/settings/frost_protection`,
        async (
          error: Error | null,
          data: FrostProtectionData
        ): Promise<void> => {
          enableButtons('frost-protection')
          if (error !== null) {
            if (raise) {
              reject(new Error(error.message))
              return
            }
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            resolve()
            return
          }
          updateBuildingMapping(data)
          refreshBuildingFrostProtectionSettings(data)
          resolve()
        }
      )
    })
  }

  function refreshBuildingSettings(): void {
    const settings: BuildingData = buildingMapping[buildingElement.value]
    refreshBuildingHolidayModeSettings(settings)
    refreshBuildingFrostProtectionSettings(settings)
  }

  async function getBuildings(): Promise<Record<string, BuildingData>> {
    return new Promise<Record<string, BuildingData>>((resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        '/buildings',
        async (error: Error | null, buildings: Building[]): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            reject(error)
            return
          }
          buildingMapping = Object.fromEntries(
            buildings.map((building: Building): [string, BuildingData] => {
              const {
                ID,
                Name,
                FPEnabled,
                FPMinTemperature,
                FPMaxTemperature,
                HMEnabled,
                HMStartDate,
                HMEndDate,
              } = building
              const optionElement: HTMLOptionElement =
                document.createElement('option')
              optionElement.value = String(ID)
              optionElement.innerText = Name
              buildingElement.appendChild(optionElement)
              return [
                String(ID),
                {
                  FPEnabled,
                  FPMinTemperature,
                  FPMaxTemperature,
                  HMEnabled,
                  HMStartDate,
                  HMEndDate,
                },
              ]
            })
          )
          refreshBuildingSettings()
          resolve(buildingMapping)
        }
      )
    })
  }

  function updateDeviceSettings(body: Settings, driverId?: string): void {
    if (driverId !== undefined && driverId in deviceSettings) {
      Object.entries(body).forEach(
        ([settingId, settingValue]: [string, SettingValue]): void => {
          deviceSettings[driverId][settingId] = [settingValue]
        }
      )
      flatDeviceSettings = flattenDeviceSettings()
    } else {
      Object.entries(body).forEach(
        ([settingId, settingValue]: [string, SettingValue]): void => {
          Object.keys(deviceSettings).forEach((driver: string): void => {
            deviceSettings[driver][settingId] = [settingValue]
          })
          flatDeviceSettings[settingId] = [settingValue]
        }
      )
    }
  }

  function setDeviceSettings(body: Settings, driverId?: string): void {
    let endPoint = '/devices/settings'
    if (driverId !== undefined) {
      const queryString: string = new URLSearchParams({
        driverId,
      }).toString()
      endPoint += `?${queryString}`
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'POST',
      endPoint,
      body,
      async (error: Error | null): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        updateDeviceSettings(body, driverId)
        enableButtons(`settings-${driverId ?? 'common'}`)
        // @ts-expect-error: homey is partially typed
        await homey.alert(homey.__('settings.success'))
      }
    )
  }

  function addApplySettingsEventListener(
    elements: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ) {
    const settings = `settings-${driverId ?? 'common'}`
    const buttonElement: HTMLButtonElement = document.getElementById(
      `apply-${settings}`
    ) as HTMLButtonElement
    buttonElement.addEventListener('click', (): void => {
      let body: Settings = {}
      try {
        body = buildSettingsBody(elements, driverId)
      } catch (error: unknown) {
        // @ts-expect-error: homey is partially typed
        homey.alert(error instanceof Error ? error.message : String(error))
        return
      }
      if (Object.keys(body).length === 0) {
        // @ts-expect-error: homey is partially typed
        homey.alert(homey.__('settings.devices.apply.nothing'))
        return
      }
      // @ts-expect-error: homey is partially typed
      homey.confirm(
        homey.__('settings.devices.apply.confirm'),
        null,
        async (error: Error | null, ok: boolean): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            return
          }
          if (ok) {
            disableButtons(settings)
            setDeviceSettings(body, driverId)
          }
        }
      )
    })
  }

  function updateCommonChildrenElement(element: HTMLSelectElement): void {
    const values: SettingValue[] | undefined = flatDeviceSettings[
      element.id.split('--')[0]
    ] as SettingValue[] | undefined
    // eslint-disable-next-line no-param-reassign
    element.value =
      values !== undefined && values.length === 1 ? String(values[0]) : ''
  }

  function addRefreshSettingsCommonEventListener(
    elements: HTMLSelectElement[]
  ): void {
    elements.forEach(updateCommonChildrenElement)
  }

  function updateCheckboxChildrenElement(
    element: HTMLInputElement,
    driverId: string
  ): void {
    const checked: boolean[] = deviceSettings[driverId][
      element.id.split('--')[0]
    ] as boolean[]
    if (checked.length === 1) {
      ;[element.checked] = checked // eslint-disable-line no-param-reassign
    } else {
      element.indeterminate = true // eslint-disable-line no-param-reassign
      element.addEventListener('change', (): void => {
        if (element.indeterminate) {
          element.indeterminate = false // eslint-disable-line no-param-reassign
        }
      })
    }
  }

  function addRefreshSettingsDriverEventListener(
    elements: HTMLInputElement[],
    driverId: string
  ): void {
    elements.forEach((element: HTMLInputElement): void => {
      updateCheckboxChildrenElement(element, driverId)
    })
  }

  function addRefreshSettingsEventListener(
    elements: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ) {
    const settings = `settings-${driverId ?? 'common'}`
    const buttonElement: HTMLButtonElement = document.getElementById(
      `refresh-${settings}`
    ) as HTMLButtonElement
    buttonElement.addEventListener('click', (): void => {
      disableButtons(settings)
      if (driverId !== undefined) {
        addRefreshSettingsDriverEventListener(
          elements as HTMLInputElement[],
          driverId
        )
      } else {
        addRefreshSettingsCommonEventListener(elements as HTMLSelectElement[])
      }
      enableButtons(settings)
    })
  }

  function addSettingsEventListeners(
    elements: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ): void {
    addApplySettingsEventListener(elements, driverId)
    addRefreshSettingsEventListener(elements, driverId)
  }

  function generateCommonChildrenElements(): void {
    driverSettingsCommon
      .filter((setting: DriverSetting) =>
        ['checkbox', 'dropdown'].includes(setting.type)
      )
      .forEach((setting: DriverSetting): void => {
        const divElement: HTMLDivElement = document.createElement('div')
        divElement.className = 'homey-form-group'
        const labelElement: HTMLLabelElement = document.createElement('label')
        labelElement.className = 'homey-form-label'
        labelElement.innerText = setting.title
        const selectElement: HTMLSelectElement =
          document.createElement('select')
        selectElement.className = 'homey-form-select'
        selectElement.id = `${setting.id}--setting`
        labelElement.htmlFor = selectElement.id
        ;[
          { id: '' },
          ...(setting.type === 'checkbox'
            ? [{ id: 'false' }, { id: 'true' }]
            : setting.values ?? []),
        ].forEach(({ id, label }: { id: string; label?: string }): void => {
          const optionElement: HTMLOptionElement =
            document.createElement('option')
          optionElement.value = id
          if (id !== '') {
            optionElement.innerText =
              label ?? homey.__(`settings.boolean.${id}`)
          }
          selectElement.appendChild(optionElement)
        })
        updateCommonChildrenElement(selectElement)
        divElement.appendChild(labelElement)
        divElement.appendChild(selectElement)
        settingsCommonElement.appendChild(divElement)
      })
    addSettingsEventListeners(
      Array.from(settingsCommonElement.querySelectorAll('select'))
    )
  }

  function generateCheckboxChildrenElements(driverId: string): void {
    const settingsElement: HTMLDivElement = document.getElementById(
      `settings-${driverId}`
    ) as HTMLDivElement
    const fieldSetElement: HTMLFieldSetElement =
      document.createElement('fieldset')
    fieldSetElement.className = 'homey-form-checkbox-set'
    let previousGroupLabel: string | undefined
    driverSettings[driverId]
      .filter((setting: DriverSetting) => setting.type === 'checkbox')
      .forEach((setting: DriverSetting): void => {
        if (setting.groupLabel !== previousGroupLabel) {
          previousGroupLabel = setting.groupLabel
          const legendElement: HTMLLegendElement =
            document.createElement('legend')
          legendElement.className = 'homey-form-checkbox-set-title'
          legendElement.innerText = setting.groupLabel ?? ''
          fieldSetElement.appendChild(legendElement)
        }
        const labelElement: HTMLLabelElement = document.createElement('label')
        labelElement.className = 'homey-form-checkbox'
        const inputElement: HTMLInputElement = document.createElement('input')
        inputElement.className = 'homey-form-checkbox-input'
        inputElement.id = `${setting.id}--settings-${driverId}`
        labelElement.htmlFor = inputElement.id
        inputElement.type = 'checkbox'
        updateCheckboxChildrenElement(inputElement, driverId)
        const checkmarkSpanElement: HTMLSpanElement =
          document.createElement('span')
        checkmarkSpanElement.className = 'homey-form-checkbox-checkmark'
        const textSpanElement: HTMLSpanElement = document.createElement('span')
        textSpanElement.className = 'homey-form-checkbox-text'
        textSpanElement.innerText = setting.title
        labelElement.appendChild(inputElement)
        labelElement.appendChild(checkmarkSpanElement)
        labelElement.appendChild(textSpanElement)
        fieldSetElement.appendChild(labelElement)
      })
    settingsElement.appendChild(fieldSetElement)
    addSettingsEventListeners(
      Array.from(fieldSetElement.querySelectorAll('input')),
      driverId
    )
    unhide(document.getElementById(`has-devices-${driverId}`) as HTMLDivElement)
  }

  async function generate(): Promise<void> {
    generateErrorLog()
    buildingMapping = await getBuildings()
  }

  function needsAuthentication(value = true): void {
    if (loginElement.childElementCount === 0) {
      const credentialKeys: (keyof LoginCredentials)[] = [
        'username',
        'password',
      ]
      ;[usernameElement, passwordElement] = credentialKeys.map(
        (credentialKey: keyof LoginCredentials): HTMLInputElement | null => {
          const driverSetting: LoginDriverSetting | undefined =
            driverSettingsAll.find(
              (setting): setting is LoginDriverSetting =>
                setting.id === credentialKey
            )
          if (driverSetting === undefined) {
            return null
          }
          const { id } = driverSetting
          const divElement: HTMLDivElement = document.createElement('div')
          divElement.classList.add('homey-form-group')
          const labelElement: HTMLLabelElement = document.createElement('label')
          labelElement.classList.add('homey-form-label')
          labelElement.innerText = driverSetting.title
          const inputElement: HTMLInputElement = document.createElement('input')
          inputElement.classList.add('homey-form-input')
          inputElement.type = driverSetting.type
          inputElement.placeholder = driverSetting.placeholder ?? ''
          inputElement.value = (homeySettings[id] as string | undefined) ?? ''
          inputElement.id = id
          labelElement.htmlFor = inputElement.id
          loginElement.appendChild(labelElement)
          loginElement.appendChild(inputElement)
          return inputElement
        }
      )
    }
    hide(authenticatedElement, value)
    unhide(authenticatingElement, value)
  }

  async function login(): Promise<void> {
    const username: string = usernameElement?.value ?? ''
    const password: string = passwordElement?.value ?? ''
    if (username === '' || password === '') {
      // @ts-expect-error: homey is partially typed
      await homey.alert(homey.__('settings.authenticate.failure'))
      return
    }
    const body: LoginCredentials = {
      username,
      password,
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'POST',
      '/login',
      body,
      async (_: Error | null, loggedIn: boolean): Promise<void> => {
        if (!loggedIn) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(homey.__('settings.authenticate.failure'))
          return
        }
        await generate()
        needsAuthentication(false)
      }
    )
  }

  async function load(): Promise<void> {
    generateCommonChildrenElements()
    if (homeySettings.ContextKey === undefined) {
      needsAuthentication()
      return
    }
    Object.keys(deviceSettings).forEach(generateCheckboxChildrenElements)
    try {
      await generate()
    } catch (error: unknown) {
      needsAuthentication()
    }
  }

  authenticateElement.addEventListener('click', (): void => {
    authenticateElement.classList.add('is-disabled')
    login()
      .catch(async (error: Error): Promise<void> => {
        // @ts-expect-error: homey is partially typed
        await homey.alert(error.message)
      })
      .finally((): void => {
        authenticateElement.classList.remove('is-disabled')
      })
  })

  sinceElement.addEventListener('change', (): void => {
    if (
      to !== '' &&
      sinceElement.value !== '' &&
      Date.parse(sinceElement.value) > Date.parse(to)
    ) {
      sinceElement.value = to
      // @ts-expect-error: homey is partially typed
      homey.alert(homey.__('settings.error_log.error', { fromDateHuman }))
    }
  })

  seeElement.addEventListener('click', (): void => {
    seeElement.classList.add('is-disabled')
    generateErrorLog()
  })

  autoAdjustElement.addEventListener('click', (): void => {
    // @ts-expect-error: homey is partially typed
    homey.openURL('https://homey.app/a/com.mecloud.extension')
  })

  buildingElement.addEventListener('change', refreshBuildingSettings)

  holidayModeEnabledElement.addEventListener('change', (): void => {
    if (holidayModeEnabledElement.value === 'false') {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })

  holidayModeStartDateElement.addEventListener('change', (): void => {
    if (holidayModeStartDateElement.value !== '') {
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
    } else if (
      holidayModeEndDateElement.value === '' &&
      holidayModeEnabledElement.value === 'true'
    ) {
      holidayModeEnabledElement.value = 'false'
    }
  })

  holidayModeEndDateElement.addEventListener('change', (): void => {
    if (holidayModeEndDateElement.value !== '') {
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
    } else if (
      holidayModeStartDateElement.value === '' &&
      holidayModeEnabledElement.value === 'true'
    ) {
      holidayModeEnabledElement.value = 'false'
    }
  })

  refreshHolidayModeElement.addEventListener('click', (): void => {
    disableButtons('holiday-mode')
    getBuildingHolidayModeSettings().catch(
      async (error: Error): Promise<void> => {
        // @ts-expect-error: homey is partially typed
        await homey.alert(error.message)
      }
    )
  })

  updateHolidayModeElement.addEventListener('click', (): void => {
    disableButtons('holiday-mode')
    const { HMEnabled, HMStartDate, HMEndDate } =
      buildingMapping[buildingElement.value]
    const Enabled: boolean = holidayModeEnabledElement.value === 'true'
    const body: HolidayModeSettings = {
      Enabled,
      StartDate: Enabled ? holidayModeStartDateElement.value : '',
      EndDate: Enabled ? holidayModeEndDateElement.value : '',
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'POST',
      `/buildings/${buildingElement.value}/settings/holiday_mode`,
      body,
      async (error: Error | null): Promise<void> => {
        enableButtons('holiday-mode')
        try {
          await getBuildingHolidayModeSettings(true)
        } catch (err: unknown) {
          refreshBuildingHolidayModeSettings({
            HMEnabled,
            HMStartDate,
            HMEndDate,
          })
          // @ts-expect-error: homey is partially typed
          await homey.alert(err.message)
          return
        }
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        // @ts-expect-error: homey is partially typed
        await homey.alert(homey.__('settings.success'))
      }
    )
  })

  frostProtectionMinimumTemperatureElement.addEventListener(
    'change',
    (): void => {
      if (frostProtectionEnabledElement.value === 'false') {
        frostProtectionEnabledElement.value = 'true'
      }
    }
  )

  frostProtectionMaximumTemperatureElement.addEventListener(
    'change',
    (): void => {
      if (frostProtectionEnabledElement.value === 'false') {
        frostProtectionEnabledElement.value = 'true'
      }
    }
  )

  refreshFrostProtectionElement.addEventListener('click', (): void => {
    disableButtons('frost-protection')
    getBuildingFrostProtectionSettings().catch(
      async (error: Error): Promise<void> => {
        // @ts-expect-error: homey is partially typed
        await homey.alert(error.message)
      }
    )
  })

  updateFrostProtectionElement.addEventListener('click', (): void => {
    disableButtons('frost-protection')
    const { FPEnabled, FPMinTemperature, FPMaxTemperature } =
      buildingMapping[buildingElement.value]
    let MinimumTemperature = 0
    let MaximumTemperature = 0
    try {
      MinimumTemperature = int(frostProtectionMinimumTemperatureElement)
      MaximumTemperature = int(frostProtectionMaximumTemperatureElement)
    } catch (error: unknown) {
      refreshBuildingFrostProtectionSettings({
        FPEnabled,
        FPMinTemperature,
        FPMaxTemperature,
      })
      enableButtons('frost-protection')
      // @ts-expect-error: homey is partially typed
      homey.alert(error instanceof Error ? error.message : String(error))
      return
    }
    if (MinimumTemperature > MaximumTemperature) {
      ;[MinimumTemperature, MaximumTemperature] = [
        MaximumTemperature,
        MinimumTemperature,
      ]
    }
    if (MaximumTemperature - MinimumTemperature < 2) {
      MaximumTemperature = MinimumTemperature + 2
    }
    frostProtectionMinimumTemperatureElement.value = String(MinimumTemperature)
    frostProtectionMaximumTemperatureElement.value = String(MaximumTemperature)
    const body: FrostProtectionSettings = {
      Enabled: frostProtectionEnabledElement.value === 'true',
      MinimumTemperature,
      MaximumTemperature,
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'POST',
      `/buildings/${buildingElement.value}/settings/frost_protection`,
      body,
      async (error: Error | null): Promise<void> => {
        enableButtons('frost-protection')
        try {
          await getBuildingFrostProtectionSettings(true)
        } catch (err: unknown) {
          refreshBuildingFrostProtectionSettings({
            FPEnabled,
            FPMinTemperature,
            FPMaxTemperature,
          })
          // @ts-expect-error: homey is partially typed
          await homey.alert(err.message)
          return
        }
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        // @ts-expect-error: homey is partially typed
        await homey.alert(homey.__('settings.success'))
      }
    )
  })

  await load()
}
