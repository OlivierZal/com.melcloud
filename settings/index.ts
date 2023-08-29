import type Homey from 'homey/lib/Homey'
import type {
  Building,
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
  LoginCredentials,
  Settings,
  SettingValue,
} from '../types'

async function onHomeyReady(homey: Homey): Promise<void> {
  await homey.ready()

  await new Promise<string>((resolve, reject) => {
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
        resolve(language)
      }
    )
  })

  async function getHomeySettings(): Promise<Settings> {
    return new Promise<Settings>((resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.get(
        async (error: Error | null, settings: Settings): Promise<void> => {
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
  }

  async function getDeviceSettings(): Promise<DeviceSettings> {
    return new Promise<DeviceSettings>((resolve, reject) => {
      // @ts-expect-error: homey is partially typed
      homey.api(
        'GET',
        '/devices/settings',
        async (
          error: Error | null,
          deviceSettings: DeviceSettings
        ): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error: homey is partially typed
            await homey.alert(error.message)
            reject(error)
            return
          }
          resolve(deviceSettings)
        }
      )
    })
  }

  function flattenDeviceSettings(
    deviceSettings: DeviceSettings
  ): DeviceSetting {
    return Object.values(deviceSettings).reduce<DeviceSetting>(
      (flatDeviceSettings, settings: DeviceSetting) =>
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
          flatDeviceSettings
        ),
      {}
    )
  }

  async function getDriverSettings(): Promise<DriverSetting[]> {
    return new Promise<DriverSetting[]>((resolve, reject) => {
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
    })
  }

  const homeySettings: Settings = await getHomeySettings()

  const deviceSettings: DeviceSettings = await getDeviceSettings()
  let flatDeviceSettings: DeviceSetting = flattenDeviceSettings(deviceSettings)

  const driverSettingsAll: DriverSetting[] = await getDriverSettings()
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

  const applySettingsCommonElement: HTMLButtonElement = document.getElementById(
    'apply-settings-common'
  ) as HTMLButtonElement
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
    document.getElementById('update-frost-protection') as HTMLButtonElement
  const updateHolidayModeElement: HTMLButtonElement = document.getElementById(
    'update-holiday-mode'
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

  let errorLogTBodyElement: HTMLTableSectionElement | null = null

  let errorCount = 0
  let fromDateHuman = ''
  let to = ''

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
    setting: HTMLInputElement | HTMLSelectElement
  ): SettingValue {
    const { value } = setting
    if (value === '') {
      return null
    }
    const intValue: number = Number.parseInt(value, 10)
    if (!Number.isNaN(intValue)) {
      return setting instanceof HTMLInputElement
        ? int(setting, intValue)
        : intValue
    }
    if (setting instanceof HTMLInputElement && setting.type === 'checkbox') {
      if (!setting.indeterminate) {
        return setting.checked
      }
      return null
    }
    return ['true', 'false'].includes(value) ? value === 'true' : value
  }

  function buildSettingsBody(
    settings: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ): Settings {
    const shouldUpdate = (
      settingId: string,
      settingValue: SettingValue
    ): boolean => {
      if (settingValue !== null) {
        const deviceSetting: SettingValue[] | undefined =
          driverId !== undefined
            ? deviceSettings[driverId][settingId]
            : flatDeviceSettings[settingId]
        return (
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          deviceSetting !== undefined &&
          (deviceSetting.length !== 1 || settingValue !== deviceSetting[0])
        )
      }
      return false
    }

    return Object.fromEntries(
      settings
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
          ([settingId]: [string, SettingValue] | [null]) => settingId !== null
        )
    )
  }

  function getBuildingHolidayModeSettings(settings?: HolidayModeData): void {
    if (settings !== undefined) {
      holidayModeEnabledElement.value = String(settings.HMEnabled)
      holidayModeStartDateElement.value = settings.HMEnabled
        ? settings.HMStartDate ?? ''
        : ''
      holidayModeEndDateElement.value = settings.HMEnabled
        ? settings.HMEndDate ?? ''
        : ''
      return
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'GET',
      `/buildings/${buildingElement.value}/settings/holiday_mode`,
      async (error: Error | null, data: HolidayModeData): Promise<void> => {
        refreshHolidayModeElement.classList.remove('is-disabled')
        updateHolidayModeElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        holidayModeEnabledElement.value = String(data.HMEnabled)
        holidayModeStartDateElement.value = data.HMEnabled
          ? data.HMStartDate ?? ''
          : ''
        holidayModeEndDateElement.value = data.HMEnabled
          ? data.HMEndDate ?? ''
          : ''
      }
    )
  }

  function getBuildingFrostProtectionSettings(
    settings?: FrostProtectionData
  ): void {
    if (settings !== undefined) {
      frostProtectionEnabledElement.value = String(settings.FPEnabled)
      frostProtectionMinimumTemperatureElement.value = String(
        settings.FPMinTemperature
      )
      frostProtectionMaximumTemperatureElement.value = String(
        settings.FPMaxTemperature
      )
      return
    }
    // @ts-expect-error: homey is partially typed
    homey.api(
      'GET',
      `/buildings/${buildingElement.value}/settings/frost_protection`,
      async (error: Error | null, data: FrostProtectionData): Promise<void> => {
        refreshFrostProtectionElement.classList.remove('is-disabled')
        updateFrostProtectionElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error: homey is partially typed
          await homey.alert(error.message)
          return
        }
        frostProtectionEnabledElement.value = String(data.FPEnabled)
        frostProtectionMinimumTemperatureElement.value = String(
          data.FPMinTemperature
        )
        frostProtectionMaximumTemperatureElement.value = String(
          data.FPMaxTemperature
        )
      }
    )
  }

  async function getBuildings(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
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
          if (buildingElement.childElementCount === 0) {
            buildings.forEach((building: Building): void => {
              const { ID, Name } = building
              const optionElement: HTMLOptionElement =
                document.createElement('option')
              optionElement.value = String(ID)
              optionElement.innerText = Name
              buildingElement.appendChild(optionElement)
            })
          }
          if (buildings.length > 0) {
            const {
              HMEnabled,
              HMStartDate,
              HMEndDate,
              FPEnabled,
              FPMinTemperature,
              FPMaxTemperature,
            } = buildings[0]
            getBuildingHolidayModeSettings({
              HMEnabled,
              HMStartDate,
              HMEndDate,
            })
            getBuildingFrostProtectionSettings({
              FPEnabled,
              FPMinTemperature,
              FPMaxTemperature,
            })
          }
          resolve()
        }
      )
    })
  }

  function updateDeviceSettings(body: Settings, driverId?: string): void {
    if (driverId !== undefined) {
      Object.entries(body).forEach(
        ([settingId, settingValue]: [string, SettingValue]): void => {
          deviceSettings[driverId][settingId] = [settingValue]
        }
      )
      flatDeviceSettings = flattenDeviceSettings(deviceSettings)
    } else {
      Object.entries(body).forEach(
        ([settingId, settingValue]: [string, SettingValue]): void => {
          Object.keys(deviceSettings).forEach((id: string): void => {
            deviceSettings[id][settingId] = [settingValue]
          })
          flatDeviceSettings[settingId] = [settingValue]
        }
      )
    }
  }

  function setDeviceSettings(
    buttonElement: HTMLButtonElement,
    body: Settings,
    driverId?: string
  ): void {
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
        buttonElement.classList.remove('is-disabled')
        // @ts-expect-error: homey is partially typed
        await homey.alert(homey.__('settings.success'))
      }
    )
  }

  function addSettingsEventListener(
    buttonElement: HTMLButtonElement,
    elements: (HTMLInputElement | HTMLSelectElement)[],
    driverId?: string
  ): void {
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
            buttonElement.classList.add('is-disabled')
            setDeviceSettings(buttonElement, body, driverId)
          }
        }
      )
    })
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
        const values: SettingValue[] | undefined =
          flatDeviceSettings[setting.id]
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (values !== undefined && values.length === 1) {
          selectElement.value = String(values[0])
        }
        divElement.appendChild(labelElement)
        divElement.appendChild(selectElement)
        settingsCommonElement.appendChild(divElement)
      })
    addSettingsEventListener(
      applySettingsCommonElement,
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
        const checked: boolean[] = deviceSettings[driverId][
          setting.id
        ] as boolean[]
        if (checked.length === 1) {
          ;[inputElement.checked] = checked
        } else {
          inputElement.indeterminate = true
          inputElement.addEventListener('change', (): void => {
            if (inputElement.indeterminate) {
              inputElement.indeterminate = false
            }
          })
        }
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
    addSettingsEventListener(
      document.getElementById(
        `apply-settings-${driverId}`
      ) as HTMLButtonElement,
      Array.from(fieldSetElement.querySelectorAll('input')),
      driverId
    )
    unhide(document.getElementById(`has-devices-${driverId}`) as HTMLDivElement)
  }

  async function generate(): Promise<void> {
    await getBuildings()
    generateErrorLog()
  }

  function needsAuthentication(value = true): void {
    if (loginElement.childElementCount === 0) {
      ;[usernameElement, passwordElement] = ['username', 'password'].map(
        (credentialKey: string): HTMLInputElement | null => {
          const driverSetting: DriverSetting | undefined =
            driverSettingsAll.find(
              (setting: DriverSetting) => setting.id === credentialKey
            )
          if (driverSetting === undefined) {
            return null
          }
          const divElement: HTMLDivElement = document.createElement('div')
          divElement.classList.add('homey-form-group')
          const labelElement: HTMLLabelElement = document.createElement('label')
          labelElement.classList.add('homey-form-label')
          labelElement.innerText = driverSetting.title
          const inputElement: HTMLInputElement = document.createElement('input')
          inputElement.classList.add('homey-form-input')
          inputElement.type = driverSetting.type
          inputElement.placeholder = driverSetting.placeholder ?? ''
          inputElement.value =
            (homeySettings[driverSetting.id] as string | undefined) ?? ''
          inputElement.id = driverSetting.id
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

  buildingElement.addEventListener('change', (): void => {
    getBuildingHolidayModeSettings()
    getBuildingFrostProtectionSettings()
  })

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
    refreshHolidayModeElement.classList.add('is-disabled')
    updateHolidayModeElement.classList.add('is-disabled')
    getBuildingHolidayModeSettings()
  })

  updateHolidayModeElement.addEventListener('click', (): void => {
    refreshHolidayModeElement.classList.add('is-disabled')
    updateHolidayModeElement.classList.add('is-disabled')
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
        refreshHolidayModeElement.classList.remove('is-disabled')
        updateHolidayModeElement.classList.remove('is-disabled')
        if (error !== null) {
          getBuildingHolidayModeSettings()
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
    refreshFrostProtectionElement.classList.add('is-disabled')
    updateFrostProtectionElement.classList.add('is-disabled')
    getBuildingFrostProtectionSettings()
  })

  updateFrostProtectionElement.addEventListener('click', (): void => {
    refreshFrostProtectionElement.classList.add('is-disabled')
    updateFrostProtectionElement.classList.add('is-disabled')
    let MinimumTemperature = 0
    let MaximumTemperature = 0
    try {
      MinimumTemperature = int(frostProtectionMinimumTemperatureElement)
      MaximumTemperature = int(frostProtectionMaximumTemperatureElement)
    } catch (error: unknown) {
      refreshFrostProtectionElement.classList.remove('is-disabled')
      updateFrostProtectionElement.classList.remove('is-disabled')
      getBuildingFrostProtectionSettings()
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
        refreshFrostProtectionElement.classList.remove('is-disabled')
        updateFrostProtectionElement.classList.remove('is-disabled')
        if (error !== null) {
          getBuildingFrostProtectionSettings()
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
