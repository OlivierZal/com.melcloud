import type Homey from 'homey/lib/Homey'
import {
  type Building,
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionSettings,
  type HolidayModeData,
  type HolidayModeSettings,
  type LoginCredentials,
  type MELCloudDevice,
  type Settings,
  type SettingsData
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady(Homey: Homey): Promise<void> {
  await Homey.ready()

  async function getLocale(): Promise<string> {
    return await new Promise((resolve, reject) => {
      // @ts-expect-error bug
      Homey.api(
        'GET',
        '/locale',
        async (error: Error, locale: string): Promise<void> => {
          if (error !== null) {
            reject(error)
            return
          }
          document.documentElement.setAttribute('lang', locale)
          resolve(locale)
        }
      )
    })
  }

  async function getDeviceSettings(driverId?: string): Promise<SettingsData[]> {
    return await new Promise<SettingsData[]>((resolve, reject) => {
      let endPoint: string = '/devices/settings'
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
        async (error: Error, settings: SettingsData[]): Promise<void> => {
          if (error !== null) {
            // @ts-expect-error bug
            await Homey.alert(error.message)
            reject(error)
            return
          }
          resolve(settings)
        }
      )
    })
  }

  function getDeviceSetting(
    settings: SettingsData[],
    id: string
  ): SettingsData | undefined {
    return settings.find((setting: SettingsData): boolean => setting.id === id)
  }

  const locale: string = await getLocale()
  const settingsAta: SettingsData[] = await getDeviceSettings('melcloud')

  const settingsMixin: string[] = ['always_on']
  const minimumTemperature: number = 10
  const maximumTemperature: number = 38

  const applySettingsAtaElement: HTMLButtonElement = document.getElementById(
    'apply-settings-ata'
  ) as HTMLButtonElement
  const applySettingsElement: HTMLButtonElement = document.getElementById(
    'apply-settings'
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

  const isAuthenticatedElement: HTMLDivElement = document.getElementById(
    'is-authenticated'
  ) as HTMLDivElement
  const isNotAuthenticatedElement: HTMLDivElement = document.getElementById(
    'is-not-authenticated'
  ) as HTMLDivElement
  const hasDevicesAtaElement: HTMLDivElement = document.getElementById(
    'has-devices-ata'
  ) as HTMLDivElement
  const hasErrorLogElement: HTMLDivElement = document.getElementById(
    'has-error-log'
  ) as HTMLDivElement

  const fromElement: HTMLInputElement = document.getElementById(
    'from'
  ) as HTMLInputElement
  const frostProtectionMinimumTemperatureElement: HTMLInputElement =
    document.getElementById('min') as HTMLInputElement
  const frostProtectionMaximumTemperatureElement: HTMLInputElement =
    document.getElementById('max') as HTMLInputElement
  const holidayModeStartDateElement: HTMLInputElement = document.getElementById(
    'start-date'
  ) as HTMLInputElement
  const holidayModeEndDateElement: HTMLInputElement = document.getElementById(
    'end-date'
  ) as HTMLInputElement
  const passwordElement: HTMLInputElement = document.getElementById(
    'password'
  ) as HTMLInputElement
  const usernameElement: HTMLInputElement = document.getElementById(
    'username'
  ) as HTMLInputElement

  const alwaysOnLabelElement: HTMLLabelElement = document.getElementById(
    'settings-always_on'
  ) as HTMLLabelElement
  const periodLabelElement: HTMLLabelElement = document.getElementById(
    'period'
  ) as HTMLLabelElement

  const alwaysOnElement: HTMLSelectElement = document.getElementById(
    'always_on'
  ) as HTMLSelectElement
  const buildingElement: HTMLSelectElement = document.getElementById(
    'buildings'
  ) as HTMLSelectElement
  const frostProtectionEnabledElement: HTMLSelectElement =
    document.getElementById('enabled-frost-protection') as HTMLSelectElement
  const holidayModeEnabledElement: HTMLSelectElement = document.getElementById(
    'enabled-holiday-mode'
  ) as HTMLSelectElement

  const errorLogTableElement: HTMLTableElement = document.getElementById(
    'error-log-table'
  ) as HTMLTableElement

  let hasLoadedErrorLogTableHead: boolean = false
  let errorCount: number = 0
  let fromDateHuman: string = ''
  let to: string = ''

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

  function generateTableHead(table: HTMLTableElement, keys: string[]): void {
    const thead: HTMLTableSectionElement = table.createTHead()
    const row: HTMLTableRowElement = thead.insertRow()
    for (const key of keys) {
      const th: HTMLTableCellElement = document.createElement('th')
      th.innerText = Homey.__(`settings.error_log.columns.${key}`)
      row.appendChild(th)
    }
    hasLoadedErrorLogTableHead = true
  }

  function generateTable(
    table: HTMLTableElement,
    errors: ErrorLog['Errors']
  ): void {
    const tbody: HTMLTableSectionElement = table.createTBody()
    for (const error of errors) {
      const row: HTMLTableRowElement = tbody.insertRow()
      for (const value of Object.values(error)) {
        const cell: HTMLTableCellElement = row.insertCell()
        cell.innerText = value
      }
    }
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
      from: fromElement.value,
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
        if (error !== null) {
          if (error.message.includes('403')) {
            // @ts-expect-error bug
            await Homey.alert(Homey.__('settings.error_log.failure'))
            return
          }
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        fromDateHuman = data.FromDateHuman
        fromElement.value = data.NextFromDate
        to = data.NextToDate
        errorCount += data.Errors.length
        periodLabelElement.innerText = Homey.__('settings.error_log.period', {
          fromDateHuman,
          errorCount,
          errorCountText: getErrorCountText(errorCount)
        })
        hasErrorLogElement.style.display = 'block'
        if (data.Errors.length > 0) {
          if (!hasLoadedErrorLogTableHead) {
            generateTableHead(errorLogTableElement, Object.keys(data.Errors[0]))
          }
          generateTable(errorLogTableElement, data.Errors)
        }
      }
    )
  }

  function int(
    element: HTMLInputElement,
    value: number = Number.parseInt(element.value)
  ): number {
    if (
      Number.isNaN(value) ||
      value < Number(element.min) ||
      value > Number(element.max)
    ) {
      element.value = ''
      throw new Error(
        Homey.__('settings.int_error.message', {
          name: Homey.__(`settings.int_error.values.${element.id}`),
          min: element.min,
          max: element.max
        })
      )
    }
    return value
  }

  function buildSettingsBody(
    settings: Array<HTMLInputElement | HTMLSelectElement>
  ): Settings {
    const body: Settings = {}
    for (const setting of settings) {
      if (setting.value !== '') {
        const settingValue: number = Number.parseInt(setting.value)
        if (!Number.isNaN(settingValue)) {
          body[setting.id] =
            setting instanceof HTMLInputElement
              ? int(setting, settingValue)
              : settingValue
        } else if (
          setting instanceof HTMLInputElement &&
          setting.type === 'checkbox'
        ) {
          body[setting.id] = setting.checked
        } else if (['true', 'false'].includes(setting.value)) {
          body[setting.id] = setting.value === 'true'
        } else {
          body[setting.id] = setting.value
        }
      }
    }
    return body
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

  async function getBuildings(): Promise<boolean> {
    return await new Promise<boolean>((resolve, reject) => {
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
          for (const building of buildings) {
            const { ID, Name } = building
            const option: HTMLOptionElement = document.createElement('option')
            option.setAttribute('value', String(ID))
            const optionText: Text = document.createTextNode(Name)
            option.appendChild(optionText)
            buildingElement.appendChild(option)
          }
          if (buildings.length === 0) {
            resolve(false)
            return
          }
          const {
            HMEnabled,
            HMStartDate,
            HMEndDate,
            FPEnabled,
            FPMinTemperature,
            FPMaxTemperature
          } = buildings[0]
          getBuildingHolidayModeSettings({ HMEnabled, HMStartDate, HMEndDate })
          getBuildingFrostProtectionSettings({
            FPEnabled,
            FPMinTemperature,
            FPMaxTemperature
          })
          resolve(true)
        }
      )
    })
  }

  async function hasAuthenticated(): Promise<void> {
    const isBuilding: boolean = await getBuildings()
    if (!isBuilding) {
      // @ts-expect-error bug
      await Homey.alert(Homey.__('settings.buildings.error'))
      return
    }
    generateErrorLog()
    isNotAuthenticatedElement.style.display = 'none'
    isAuthenticatedElement.style.display = 'block'
  }

  async function hasDevices(driverId?: string): Promise<boolean> {
    return await new Promise((resolve, reject) => {
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
          if (devices.length > 0) {
            resolve(true)
            return
          }
          resolve(false)
        }
      )
    })
  }

  async function generateSettingsAtaChildrenElements(): Promise<void> {
    const dashboardAtaElement: HTMLLegendElement = document.getElementById(
      'settings-ata-dashboard'
    ) as HTMLLegendElement
    dashboardAtaElement.innerText =
      getDeviceSetting(settingsAta, 'measure_power.wifi')?.label[locale] ?? ''

    const settingsAtaElement: HTMLFieldSetElement = document.getElementById(
      'settings-ata'
    ) as HTMLFieldSetElement
    for (const setting of settingsAta.filter(
      (setting: SettingsData): boolean => !settingsMixin.includes(setting.id)
    )) {
      const label = document.createElement('label')
      const input = document.createElement('input')
      const checkmarkSpan = document.createElement('span')
      const textSpan = document.createElement('span')
      label.className = 'homey-form-checkbox'
      input.className = 'homey-form-checkbox-input'
      input.type = 'checkbox'
      input.id = setting.id
      checkmarkSpan.className = 'homey-form-checkbox-checkmark'
      textSpan.className = 'homey-form-checkbox-text'
      textSpan.innerText = setting.title[locale]
      label.appendChild(input)
      label.appendChild(checkmarkSpan)
      label.appendChild(textSpan)
      settingsAtaElement.appendChild(label)
    }
    addSettingsEventListener(
      applySettingsAtaElement,
      Array.from(settingsAtaElement.querySelectorAll('input')),
      'melcloud'
    )
  }

  function login(): void {
    const body: LoginCredentials = {
      username: usernameElement.value,
      password: passwordElement.value
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      '/login',
      body,
      async (error: Error, login: boolean): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!login) {
          // @ts-expect-error bug
          await Homey.alert(
            Homey.__('settings.alert.failure', {
              action: Homey.__('settings.alert.actions.authenticate')
            })
          )
          return
        }
        await hasAuthenticated()
        const hasDevicesAta = await hasDevices('melcloud')
        if (hasDevicesAta) {
          await generateSettingsAtaChildrenElements()
          hasDevicesAtaElement.style.display = 'block'
        }
      }
    )
  }

  function setDeviceSettings(body: Settings, driverId?: string): void {
    let endPoint: string = '/devices/settings'
    if (driverId !== undefined) {
      const queryString: string = new URLSearchParams({
        driverId
      }).toString()
      endPoint += `?${queryString}`
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      endPoint,
      body,
      async (error: Error, success: boolean): Promise<void> => {
        if (error !== null) {
          setDeviceSettings(body, driverId)
          return
        }
        if (!success) {
          // @ts-expect-error bug
          await Homey.alert(
            Homey.__('settings.alert.failure', {
              action: Homey.__('settings.alert.actions.update')
            })
          )
          return
        }
        // @ts-expect-error bug
        await Homey.alert(
          Homey.__('settings.alert.success', {
            action: Homey.__('settings.alert.actions.update')
          })
        )
      }
    )
  }

  function addSettingsEventListener(
    buttonElement: HTMLButtonElement,
    elements: Array<HTMLInputElement | HTMLSelectElement>,
    driverId?: string
  ): void {
    buttonElement.addEventListener('click', (): void => {
      let body: Settings = {}
      try {
        body = buildSettingsBody(elements)
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
          if (!ok) {
            // @ts-expect-error bug
            await Homey.alert(
              Homey.__('settings.alert.failure', {
                action: Homey.__('settings.alert.actions.update')
              })
            )
            return
          }
          setDeviceSettings(body, driverId)
        }
      )
    })
  }

  frostProtectionMinimumTemperatureElement.min = String(minimumTemperature)
  frostProtectionMinimumTemperatureElement.max = String(maximumTemperature)
  frostProtectionMaximumTemperatureElement.min = String(minimumTemperature)
  frostProtectionMaximumTemperatureElement.max = String(maximumTemperature)

  const alwaysOnSetting = getDeviceSetting(settingsAta, 'always_on')
  alwaysOnLabelElement.innerText = alwaysOnSetting?.title[locale] ?? ''

  await getHomeySetting(usernameElement)
  await getHomeySetting(passwordElement)
  login()

  authenticateElement.addEventListener('click', (): void => {
    login()
  })

  fromElement.addEventListener('change', (): void => {
    if (
      to !== '' &&
      fromElement.value !== '' &&
      Date.parse(fromElement.value) > Date.parse(to)
    ) {
      fromElement.value = to
      // @ts-expect-error bug
      Homey.alert(Homey.__('settings.error_log.error', { fromDateHuman }))
    }
  })

  seeElement.addEventListener('click', (): void => {
    generateErrorLog()
  })

  addSettingsEventListener(applySettingsElement, [alwaysOnElement])

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
    getBuildingHolidayModeSettings()
  })

  updateHolidayModeElement.addEventListener('click', (): void => {
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
      async (error: Error, success: boolean): Promise<void> => {
        getBuildingHolidayModeSettings()
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!success) {
          // @ts-expect-error bug
          await Homey.alert(
            Homey.__('settings.alert.failure', {
              action: Homey.__('settings.alert.actions.update')
            })
          )
          return
        }
        // @ts-expect-error bug
        await Homey.alert(
          Homey.__('settings.alert.success', {
            action: Homey.__('settings.alert.actions.update')
          })
        )
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
    getBuildingFrostProtectionSettings()
  })

  updateFrostProtectionElement.addEventListener('click', (): void => {
    let frostProtectionMinimumTemperature: number = 0
    let frostProtectionMaximumTemperature: number = 0
    try {
      frostProtectionMinimumTemperature = int(
        frostProtectionMinimumTemperatureElement
      )
      frostProtectionMaximumTemperature = int(
        frostProtectionMaximumTemperatureElement
      )
    } catch (error: unknown) {
      getBuildingFrostProtectionSettings()
      // @ts-expect-error bug
      Homey.alert(error instanceof Error ? error.message : String(error))
      return
    }
    const body: FrostProtectionSettings = {
      Enabled: frostProtectionEnabledElement.value === 'true',
      MinimumTemperature: Math.min(
        frostProtectionMinimumTemperature,
        frostProtectionMaximumTemperature
      ),
      MaximumTemperature: Math.max(
        frostProtectionMinimumTemperature,
        frostProtectionMaximumTemperature
      )
    }
    // @ts-expect-error bug
    Homey.api(
      'POST',
      `/buildings/${buildingElement.value}/settings/frost_protection`,
      body,
      async (error: Error, success: boolean): Promise<void> => {
        getBuildingFrostProtectionSettings()
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!success) {
          // @ts-expect-error bug
          await Homey.alert(
            Homey.__('settings.alert.failure', {
              action: Homey.__('settings.alert.actions.update')
            })
          )
          return
        }
        // @ts-expect-error bug
        await Homey.alert(
          Homey.__('settings.alert.success', {
            action: Homey.__('settings.alert.actions.update')
          })
        )
      }
    )
  })
}
