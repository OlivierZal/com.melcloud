import type Homey from 'homey/lib/Homey'
import {
  type Building,
  type DeviceSettings,
  type DriverSetting,
  type ErrorDetails,
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionSettings,
  type HolidayModeData,
  type HolidayModeSettings,
  type LoginCredentials,
  type MELCloudDevice,
  type Settings
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady(Homey: Homey): Promise<void> {
  await Homey.ready()

  await new Promise<string>((resolve, reject) => {
    // @ts-expect-error bug
    Homey.api(
      'GET',
      '/language',
      async (error: Error, language: string): Promise<void> => {
        if (error !== null) {
          reject(error)
          return
        }
        document.documentElement.setAttribute('lang', language)
        resolve(language)
      }
    )
  })

  async function getDeviceSettings(): Promise<DeviceSettings> {
    return await new Promise<DeviceSettings>((resolve, reject) => {
      // @ts-expect-error bug
      Homey.api(
        'GET',
        '/devices/settings',
        async (error: Error, deviceSettings: DeviceSettings): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
            reject(error)
            return
          }
          resolve(deviceSettings)
        }
      )
    })
  }

  async function getDriverSettings(): Promise<DriverSetting[]> {
    return await new Promise<DriverSetting[]>((resolve, reject) => {
      // @ts-expect-error bug
      Homey.api(
        'GET',
        '/drivers/settings',
        async (
          error: Error,
          driverSettings: DriverSetting[]
        ): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
            reject(error)
            return
          }
          resolve(driverSettings)
        }
      )
    })
  }

  function flattenDeviceSettings(): Record<string, any[]> {
    return Object.values(deviceSettings).reduce<Record<string, any[]>>(
      (acc, settings: Record<string, any[]>) => {
        return Object.entries(settings).reduce<Record<string, any[]>>(
          (merged, [settingId, settingValues]: [string, any[]]) => {
            if (merged[settingId] === undefined) {
              merged[settingId] = []
            }
            merged[settingId].push(
              ...settingValues.filter(
                (settingValue: any): boolean =>
                  !merged[settingId].includes(settingValue)
              )
            )
            return merged
          },
          acc
        )
      },
      {}
    )
  }

  const deviceSettings: DeviceSettings = await getDeviceSettings()
  let flatDeviceSettings: Record<string, any[]> = flattenDeviceSettings()

  const allDriverSettings: DriverSetting[] = await getDriverSettings()
  const { driverSettingsMixin, driverSettings } = allDriverSettings
    .filter((setting: DriverSetting): boolean => setting.groupId !== 'login')
    .reduce<{
      driverSettingsMixin: DriverSetting[]
      driverSettings: Record<string, DriverSetting[]>
    }>(
      (acc, setting: DriverSetting) => {
        if (setting.groupId === 'options') {
          !acc.driverSettingsMixin.some(
            (option: DriverSetting): boolean => option.id === setting.id
          ) && acc.driverSettingsMixin.push(setting)
        } else {
          const driverId: string = setting.driverId
          if (acc.driverSettings[driverId] === undefined) {
            acc.driverSettings[driverId] = []
          }
          acc.driverSettings[driverId].push(setting)
        }
        return acc
      },
      {
        driverSettingsMixin: [],
        driverSettings: {}
      }
    )

  async function getHomeySetting(
    element: HTMLInputElement | HTMLSelectElement,
    defaultValue: any = ''
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      // @ts-expect-error bug
      Homey.get(element.id, async (error: Error, value: any): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          reject(error)
          return
        }
        element.value = String(value ?? defaultValue)
        resolve()
      })
    })
  }

  const intMinValueMap = new WeakMap<HTMLInputElement, number>()
  const intMaxValueMap = new WeakMap<HTMLInputElement, number>()

  const minMinTemperature: number = 4
  const maxMinTemperature: number = 14
  const minMaxTemperature: number = 6
  const maxMaxTemperature: number = 16

  const applySettingsMixinElement: HTMLButtonElement = document.getElementById(
    'apply-settings-mixin'
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
  const settingsMixinElement: HTMLDivElement = document.getElementById(
    'settings-mixin'
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

  const [usernameElement, passwordElement]: Array<HTMLInputElement | null> =
    await Promise.all(
      ['username', 'password'].map(
        async (credentialKey: string): Promise<HTMLInputElement | null> => {
          const setting: DriverSetting | undefined = allDriverSettings.find(
            (setting: DriverSetting): boolean => setting.id === credentialKey
          )
          if (setting === undefined) {
            return null
          }
          const divElement: HTMLDivElement = document.createElement('div')
          divElement.classList.add('homey-form-group')
          const labelElement: HTMLLabelElement = document.createElement('label')
          labelElement.classList.add('homey-form-label')
          labelElement.innerText = setting.title
          const inputElement: HTMLInputElement = document.createElement('input')
          inputElement.classList.add('homey-form-input')
          inputElement.id = setting.id
          labelElement.setAttribute('for', inputElement.id)
          inputElement.type = setting.type
          inputElement.placeholder = setting.placeholder ?? ''
          await getHomeySetting(inputElement)
          loginElement.appendChild(labelElement)
          loginElement.appendChild(inputElement)
          return inputElement
        }
      )
    )

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

  let errorLogTableElement: HTMLTableElement | null = document.getElementById(
    'error-log-table'
  ) as HTMLTableElement | null

  let errorCount: number = 0
  let fromDateHuman: string = ''
  let to: string = ''

  function unhide(element: HTMLDivElement, value: boolean = true): void {
    if (value) {
      element.classList.contains('hidden') && element.classList.remove('hidden')
    } else if (!element.classList.contains('hidden')) {
      element.classList.add('hidden')
    }
  }

  function hide(element: HTMLDivElement, value: boolean = true): void {
    unhide(element, !value)
  }

  function generateErrorLogTable(keys: string[]): HTMLTableElement {
    const tableElement: HTMLTableElement = document.createElement('table')
    tableElement.className = 'bordered'
    tableElement.id = 'error-log-table'
    tableElement.setAttribute('aria-describedby', 'Error Log')
    const theadElement: HTMLTableSectionElement = tableElement.createTHead()
    const rowElement: HTMLTableRowElement = theadElement.insertRow()
    keys.forEach((key: string): void => {
      const thElement: HTMLTableCellElement = document.createElement('th')
      thElement.innerText = Homey.__(`settings.error_log.columns.${key}`)
      rowElement.appendChild(thElement)
    })
    errorLogElement.appendChild(tableElement)
    return tableElement
  }

  function generateErrorLogTableData(errors: ErrorDetails[]): void {
    if (errorLogTableElement === null) {
      errorLogTableElement = generateErrorLogTable(Object.keys(errors[0]))
    }
    const tbodyElement: HTMLTableSectionElement =
      errorLogTableElement.createTBody()
    errors.forEach((error: ErrorDetails): void => {
      const rowElement: HTMLTableRowElement = tbodyElement.insertRow()
      Object.values(error).forEach((value: string): void => {
        const cellElement: HTMLTableCellElement = rowElement.insertCell()
        cellElement.innerText = value
      })
    })
  }

  function getErrorCountText(errorCount: number): string {
    if (errorCount === 0) {
      return Homey.__('settings.error_log.error_count_text_0')
    }
    if (errorCount === 1) {
      return Homey.__('settings.error_log.error_count_text_1')
    }
    if (
      [2, 3, 4].includes(errorCount % 10) &&
      ![12, 13, 14].includes(errorCount % 100)
    ) {
      return Homey.__('settings.error_log.error_count_text_234')
    }
    return Homey.__('settings.error_log.error_count_text_plural')
  }

  function generateErrorLog(): void {
    const query: ErrorLogQuery = {
      from: sinceElement.value,
      to,
      limit: '29',
      offset: '0'
    }
    const queryString: string = new URLSearchParams(
      query as Record<string, string>
    ).toString()
    // @ts-expect-error bug
    Homey.api(
      'GET',
      `/error_log?${queryString}`,
      async (error: Error, data: ErrorLog): Promise<void> => {
        seeElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        fromDateHuman = data.FromDateHuman
        sinceElement.value = data.NextFromDate
        to = data.NextToDate
        errorCount += data.Errors.length
        periodLabelElement.innerText = Homey.__('settings.error_log.period', {
          fromDateHuman
        })
        errorCountLabelElement.innerText = `${errorCount} ${getErrorCountText(
          errorCount
        )}`
        if (data.Errors.length > 0) {
          generateErrorLogTableData(data.Errors)
        }
      }
    )
  }

  function int(
    element: HTMLInputElement,
    value: number = Number.parseInt(element.value)
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
      element.value = ''
      const labelElement: HTMLLabelElement | null = document.querySelector(
        `label[for="${element.id}"]`
      )
      throw new Error(
        Homey.__('settings.int_error', {
          name: Homey.__(labelElement?.innerText ?? ''),
          min: minValue,
          max: maxValue
        })
      )
    }
    return value
  }

  function processSettingValue(
    setting: HTMLInputElement | HTMLSelectElement
  ): any {
    const value: any = setting.value
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
      return
    }
    return ['true', 'false'].includes(value) ? value === 'true' : value
  }

  function buildSettingsBody(
    settings: Array<HTMLInputElement | HTMLSelectElement>,
    driverId?: string
  ): Settings {
    const shouldUpdate = (
      settingValue: any,
      settingId: string,
      driverId?: string
    ): boolean => {
      if (settingValue === undefined) {
        return false
      }
      const deviceSetting: any[] =
        driverId !== undefined
          ? deviceSettings[driverId][settingId]
          : flatDeviceSettings[settingId]
      return deviceSetting.length !== 1 || settingValue !== deviceSetting[0]
    }

    return settings.reduce<Settings>(
      (body, setting: HTMLInputElement | HTMLSelectElement) => {
        if (setting.value === '') {
          return body
        }
        const settingValue: any = processSettingValue(setting)
        if (shouldUpdate(settingValue, setting.id, driverId)) {
          body[setting.id] = settingValue
        }
        return body
      },
      {}
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
    // @ts-expect-error bug
    Homey.api(
      'GET',
      `/buildings/${buildingElement.value}/settings/holiday_mode`,
      async (error: Error, data: HolidayModeData): Promise<void> => {
        refreshHolidayModeElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
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
    // @ts-expect-error bug
    Homey.api(
      'GET',
      `/buildings/${buildingElement.value}/settings/frost_protection`,
      async (error: Error, data: FrostProtectionData): Promise<void> => {
        refreshFrostProtectionElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
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
      // @ts-expect-error bug
      Homey.api(
        'GET',
        '/buildings',
        async (
          error: Error,
          buildings: Array<Building<MELCloudDevice>>
        ): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
            reject(error)
            return
          }
          if (buildingElement.childElementCount === 0) {
            buildings.forEach((building: Building<MELCloudDevice>): void => {
              const { ID, Name } = building
              const optionElement: HTMLOptionElement =
                document.createElement('option')
              optionElement.value = String(ID)
              optionElement.innerText = Name
              buildingElement.appendChild(optionElement)
            })
            const {
              HMEnabled,
              HMStartDate,
              HMEndDate,
              FPEnabled,
              FPMinTemperature,
              FPMaxTemperature
            } = buildings[0]
            getBuildingHolidayModeSettings({
              HMEnabled,
              HMStartDate,
              HMEndDate
            })
            getBuildingFrostProtectionSettings({
              FPEnabled,
              FPMinTemperature,
              FPMaxTemperature
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
        ([settingId, settingValue]: [string, any]): void => {
          deviceSettings[driverId][settingId] = [settingValue]
        }
      )
      flatDeviceSettings = flattenDeviceSettings()
    } else {
      Object.entries(body).forEach(
        ([settingId, settingValue]: [string, any]): void => {
          Object.values(deviceSettings).forEach(
            (settings: Record<string, any[]>): void => {
              settings[settingId] = [settingValue]
            }
          )
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
    let endPoint: string = '/devices/settings'
    if (driverId !== undefined) {
      const queryString: string = new URLSearchParams({
        driverId
      }).toString()
      endPoint += `?${queryString}`
    }
    // @ts-expect-error bug
    Homey.api('POST', endPoint, body, async (error: Error): Promise<void> => {
      if (error !== null) {
        // @ts-expect-error bug
        await Homey.alert(error.message)
        return
      }
      updateDeviceSettings(body, driverId)
      buttonElement.classList.remove('is-disabled')
      // @ts-expect-error bug
      await Homey.alert(Homey.__('settings.success'))
    })
  }

  function addSettingsEventListener(
    buttonElement: HTMLButtonElement,
    elements: Array<HTMLInputElement | HTMLSelectElement>,
    driverId?: string
  ): void {
    buttonElement.addEventListener('click', (): void => {
      let body: Settings = {}
      try {
        body = buildSettingsBody(elements, driverId)
      } catch (error: unknown) {
        // @ts-expect-error bug
        Homey.alert(error instanceof Error ? error.message : String(error))
        return
      }
      if (Object.keys(body).length === 0) {
        // @ts-expect-error bug
        Homey.alert(Homey.__('settings.devices.apply.nothing'))
        return
      }
      // @ts-expect-error bug
      Homey.confirm(
        Homey.__('settings.devices.apply.confirm'),
        null,
        async (error: Error, ok: boolean): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
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

  function generateMixinChildrenElements(): void {
    if (settingsMixinElement.childElementCount > 0) {
      return
    }
    driverSettingsMixin
      .filter((setting: DriverSetting): boolean =>
        ['checkbox', 'dropdown'].includes(setting.type)
      )
      .forEach((setting: DriverSetting): void => {
        const divElement: HTMLDivElement = document.createElement('div')
        divElement.className = 'homey-form-group'
        const labelElement = document.createElement('label')
        labelElement.className = 'homey-form-label'
        labelElement.id = `setting-${setting.id}`
        labelElement.innerText = setting.title
        const selectElement = document.createElement('select')
        selectElement.className = 'homey-form-select'
        selectElement.id = setting.id
        labelElement.setAttribute('for', selectElement.id)
        ;[
          { id: '' },
          ...(setting.type === 'checkbox'
            ? [{ id: 'false' }, { id: 'true' }]
            : setting.values ?? [])
        ].forEach((value: { id: string; label?: string }): void => {
          const { id, label } = value
          const optionElement: HTMLOptionElement =
            document.createElement('option')
          optionElement.value = id
          if (id !== '') {
            optionElement.innerText =
              label ?? Homey.__(`settings.boolean.${id}`)
          }
          selectElement.appendChild(optionElement)
        })
        const values: any[] = flatDeviceSettings[setting.id]
        if (values.length === 1) {
          selectElement.value = String(values[0])
        }
        divElement.appendChild(labelElement)
        divElement.appendChild(selectElement)
        settingsMixinElement.appendChild(divElement)
      })
    addSettingsEventListener(
      applySettingsMixinElement,
      Array.from(settingsMixinElement.querySelectorAll('select'))
    )
  }

  function generateCheckboxChildrenElements(driverId: string): void {
    const settingsElement: HTMLDivElement = document.getElementById(
      `settings-${driverId}`
    ) as HTMLDivElement
    if (settingsElement.childElementCount > 0) {
      return
    }
    const fieldSetElement: HTMLFieldSetElement =
      document.createElement('fieldset')
    fieldSetElement.className = 'homey-form-checkbox-set'
    let previousGroupLabel: string | undefined
    driverSettings[driverId]
      .filter((setting: DriverSetting): boolean => setting.type === 'checkbox')
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
        inputElement.id = setting.id
        inputElement.type = 'checkbox'
        const checked: any[] = deviceSettings[driverId][setting.id]
        if (checked.length === 1) {
          inputElement.checked = checked[0]
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

  async function hasDevices(driverId?: string): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
      let endPoint: string = '/devices'
      if (driverId !== undefined) {
        const queryString: string = new URLSearchParams({
          driverId
        }).toString()
        endPoint += `?${queryString}`
      }
      // @ts-expect-error bug
      Homey.api(
        'GET',
        endPoint,
        async (error: Error, devices: MELCloudDevice[]): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
            reject(error)
            return
          }
          if (devices.length === 0) {
            resolve(false)
            return
          }
          resolve(true)
        }
      )
    })
  }

  async function load(): Promise<void> {
    await getBuildings()
    generateErrorLog()
    generateMixinChildrenElements()
    await Promise.all(
      ['melcloud', 'melcloud_atw'].map(async (driverId): Promise<void> => {
        const hasDevicesForDriver: boolean = await hasDevices(driverId)
        if (hasDevicesForDriver) {
          generateCheckboxChildrenElements(driverId)
        }
      })
    )
  }

  function needsAuthentication(value: boolean = true): void {
    hide(authenticatedElement, value)
    unhide(authenticatingElement, value)
  }

  async function start(): Promise<void> {
    try {
      const username: string = usernameElement?.value ?? ''
      const password: string = passwordElement?.value ?? ''
      if (username === '' || password === '') {
        throw new Error()
      }
      await load()
    } catch (error: unknown) {
      needsAuthentication()
      // @ts-expect-error bug
      await Homey.alert(String(error))
    }
  }

  async function login(): Promise<void> {
    const username: string = usernameElement?.value ?? ''
    const password: string = passwordElement?.value ?? ''
    if (username === '' || password === '') {
      authenticateElement.classList.remove('is-disabled')
      // @ts-expect-error bug
      await Homey.alert(Homey.__('settings.authenticate.failure'))
      return
    }
    const body: LoginCredentials = {
      username,
      password
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      '/login',
      body,
      async (error: Error, login: boolean): Promise<void> => {
        authenticateElement.classList.remove('is-disabled')
        if (error !== null || !login) {
          // @ts-expect-error bug
          await Homey.alert(
            error !== null
              ? error.message
              : Homey.__('settings.authenticate.failure')
          )
          return
        }
        await load()
        needsAuthentication(false)
      }
    )
  }

  authenticateElement.addEventListener('click', (): void => {
    authenticateElement.classList.add('is-disabled')
    void login()
  })

  sinceElement.addEventListener('change', (): void => {
    if (
      to !== '' &&
      sinceElement.value !== '' &&
      Date.parse(sinceElement.value) > Date.parse(to)
    ) {
      sinceElement.value = to
      // @ts-expect-error bug
      Homey.alert(Homey.__('settings.error_log.error', { fromDateHuman }))
    }
  })

  seeElement.addEventListener('click', (): void => {
    seeElement.classList.add('is-disabled')
    generateErrorLog()
  })

  autoAdjustElement.addEventListener('click', (): void => {
    // @ts-expect-error bug
    Homey.openURL('https://homey.app/a/com.mecloud.extension')
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
    if (
      holidayModeEndDateElement.value !== '' &&
      holidayModeEnabledElement.value === 'false'
    ) {
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
    getBuildingHolidayModeSettings()
  })

  updateHolidayModeElement.addEventListener('click', (): void => {
    updateHolidayModeElement.classList.add('is-disabled')
    const Enabled: boolean = holidayModeEnabledElement.value === 'true'
    const body: HolidayModeSettings = {
      Enabled,
      StartDate: Enabled ? holidayModeStartDateElement.value : '',
      EndDate: Enabled ? holidayModeEndDateElement.value : ''
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      `/buildings/${buildingElement.value}/settings/holiday_mode`,
      body,
      async (error: Error): Promise<void> => {
        updateHolidayModeElement.classList.remove('is-disabled')
        if (error !== null) {
          getBuildingHolidayModeSettings()
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        // @ts-expect-error bug
        await Homey.alert(Homey.__('settings.success'))
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
    getBuildingFrostProtectionSettings()
  })

  updateFrostProtectionElement.addEventListener('click', (): void => {
    updateFrostProtectionElement.classList.add('is-disabled')
    let MinimumTemperature: number = 0
    let MaximumTemperature: number = 0
    try {
      MinimumTemperature = int(frostProtectionMinimumTemperatureElement)
      MaximumTemperature = int(frostProtectionMaximumTemperatureElement)
    } catch (error: unknown) {
      updateFrostProtectionElement.classList.remove('is-disabled')
      getBuildingFrostProtectionSettings()
      // @ts-expect-error bug
      Homey.alert(error instanceof Error ? error.message : String(error))
      return
    }
    if (MinimumTemperature > MaximumTemperature) {
      ;[MinimumTemperature, MaximumTemperature] = [
        MaximumTemperature,
        MinimumTemperature
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
      MaximumTemperature
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      `/buildings/${buildingElement.value}/settings/frost_protection`,
      body,
      async (error: Error): Promise<void> => {
        updateFrostProtectionElement.classList.remove('is-disabled')
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        // @ts-expect-error bug
        await Homey.alert(Homey.__('settings.success'))
      }
    )
  })

  await start()
  needsAuthentication()
}
