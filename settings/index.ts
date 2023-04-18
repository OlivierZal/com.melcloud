import type Homey from 'homey/lib/Homey'
import {
  type Building,
  type ErrorDetails,
  type ErrorLog,
  type ErrorLogQuery,
  type FrostProtectionData,
  type FrostProtectionSettings,
  type HolidayModeData,
  type HolidayModeSettings,
  type LoginCredentials,
  type MELCloudDevice,
  type Settings,
  type DeviceSetting
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

  async function getDeviceSettings(
    driverId?: string
  ): Promise<DeviceSetting[]> {
    return await new Promise<DeviceSetting[]>((resolve, reject) => {
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
        async (error: Error, settings: DeviceSetting[]): Promise<void> => {
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

  const { settings, settingsAta } = (
    await getDeviceSettings('melcloud')
  ).reduce<{ settings: DeviceSetting[]; settingsAta: DeviceSetting[] }>(
    (acc, setting: DeviceSetting) => {
      if (setting.group === 'options') {
        acc.settings.push(setting)
      } else {
        acc.settingsAta.push(setting)
      }
      return acc
    },
    { settings: [], settingsAta: [] }
  )

  const minMinTemperature: number = 4
  const maxMinTemperature: number = 14
  const minMaxTemperature: number = 6
  const maxMaxTemperature: number = 16

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

  const authenticatedElement: HTMLDivElement = document.getElementById(
    'authenticated'
  ) as HTMLDivElement
  const authenticatingElement: HTMLDivElement = document.getElementById(
    'authenticating'
  ) as HTMLDivElement
  const hasDevicesAtaElement: HTMLDivElement = document.getElementById(
    'has-devices-ata'
  ) as HTMLDivElement
  const hasErrorLogElement: HTMLDivElement = document.getElementById(
    'has-error-log'
  ) as HTMLDivElement
  const settingsElement: HTMLDivElement = document.getElementById(
    'settings'
  ) as HTMLDivElement

  const settingsAtaElement: HTMLFieldSetElement = document.getElementById(
    'settings-ata'
  ) as HTMLFieldSetElement

  const sinceElement: HTMLInputElement = document.getElementById(
    'since'
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

  const errorLogTableElement: HTMLTableElement = document.getElementById(
    'error-log-table'
  ) as HTMLTableElement

  let hasLoadedErrorLogTableHead: boolean = false
  let errorCount: number = 0
  let fromDateHuman: string = ''
  let to: string = ''

  function unhide(element: HTMLDivElement, value: boolean = true): void {
    if (value) {
      if (element.classList.contains('hidden')) {
        element.classList.remove('hidden')
      }
    } else if (!element.classList.contains('hidden')) {
      element.classList.add('hidden')
    }
  }

  function hide(element: HTMLDivElement): void {
    unhide(element, false)
  }

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

  function generateTableHead(
    tableElement: HTMLTableElement,
    keys: string[]
  ): void {
    const theadElement: HTMLTableSectionElement = tableElement.createTHead()
    const rowElement: HTMLTableRowElement = theadElement.insertRow()
    keys.forEach((key: string): void => {
      const thElement: HTMLTableCellElement = document.createElement('th')
      thElement.innerText = Homey.__(`settings.error_log.columns.${key}`)
      rowElement.appendChild(thElement)
    })
    hasLoadedErrorLogTableHead = true
  }

  function generateTable(
    tableElement: HTMLTableElement,
    errors: ErrorDetails[]
  ): void {
    const tbodyElement: HTMLTableSectionElement = tableElement.createTBody()
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
        if (error !== null) {
          seeElement.classList.remove('is-disabled')
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
        sinceElement.value = data.NextFromDate
        to = data.NextToDate
        errorCount += data.Errors.length
        seeElement.classList.remove('is-disabled')
        periodLabelElement.innerText = Homey.__('settings.error_log.period', {
          fromDateHuman
        })
        errorCountLabelElement.innerText = `${errorCount} ${getErrorCountText(
          errorCount
        )}`
        unhide(hasErrorLogElement)
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
    const minValue: number = Number(element.min)
    const maxValue: number = Number(element.max)
    if (Number.isNaN(value) || value < minValue || value > maxValue) {
      element.value = ''
      throw new Error(
        Homey.__('settings.int_error.message', {
          name: Homey.__(`settings.int_error.values.${element.id}`),
          min: minValue,
          max: maxValue
        })
      )
    }
    return value
  }

  function buildSettingsBody(
    settings: Array<HTMLInputElement | HTMLSelectElement>
  ): Settings {
    return settings.reduce<Settings>(
      (body, setting: HTMLInputElement | HTMLSelectElement) => {
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
        if (error !== null) {
          refreshHolidayModeElement.classList.remove('is-disabled')
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
        refreshHolidayModeElement.classList.remove('is-disabled')
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
          refreshFrostProtectionElement.classList.remove('is-disabled')
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
        refreshFrostProtectionElement.classList.remove('is-disabled')
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
          if (buildings.length === 0) {
            resolve(false)
            return
          }
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
    Homey.api(
      'POST',
      endPoint,
      body,
      async (error: Error, success: boolean): Promise<void> => {
        if (error !== null) {
          setDeviceSettings(buttonElement, body, driverId)
          return
        }
        buttonElement.classList.remove('is-disabled')
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
          buttonElement.classList.add('is-disabled')
          setDeviceSettings(buttonElement, body, driverId)
        }
      )
    })
  }

  function generateSelectChildrenElements(
    settings: DeviceSetting[],
    settingsElement: HTMLDivElement,
    applySettingsElement: HTMLButtonElement,
    driverId?: string
  ): void {
    settings
      .filter((setting: DeviceSetting): boolean =>
        ['checkbox', 'dropdown'].includes(setting.type)
      )
      .forEach((setting: DeviceSetting): void => {
        const divElement: HTMLDivElement = document.createElement('div')
        divElement.className = 'homey-form-group'
        const labelElement = document.createElement('label')
        labelElement.className = 'homey-form-label'
        labelElement.id = `setting-${setting.id}`
        labelElement.innerText = setting.title
        labelElement.setAttribute('for', setting.id)
        divElement.appendChild(labelElement)
        const selectElement = document.createElement('select')
        selectElement.className = 'homey-form-select'
        ;[
          { id: '' },
          ...(setting.type === 'checkbox'
            ? [{ id: 'false' }, { id: 'true' }]
            : setting.values ?? [])
        ].forEach((value: { id: string; label?: string }) => {
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
        divElement.appendChild(selectElement)
        settingsElement.appendChild(divElement)
      })
    addSettingsEventListener(
      applySettingsElement,
      Array.from(settingsElement.querySelectorAll('select')),
      driverId
    )
  }

  function generateCheckboxChildrenElements(
    settings: DeviceSetting[],
    settingsElement: HTMLFieldSetElement,
    applySettingsElement: HTMLButtonElement,
    driverId?: string
  ): void {
    settings
      .filter((setting: DeviceSetting): boolean => setting.type === 'checkbox')
      .forEach((setting: DeviceSetting): void => {
        const labelElement: HTMLLabelElement = document.createElement('label')
        labelElement.className = 'homey-form-checkbox'
        const inputElement: HTMLInputElement = document.createElement('input')
        inputElement.className = 'homey-form-checkbox-input'
        inputElement.id = setting.id
        inputElement.type = 'checkbox'
        const checkmarkSpanElement: HTMLSpanElement =
          document.createElement('span')
        checkmarkSpanElement.className = 'homey-form-checkbox-checkmark'
        const textSpanElement: HTMLSpanElement = document.createElement('span')
        textSpanElement.className = 'homey-form-checkbox-text'
        textSpanElement.innerText = setting.title
        labelElement.appendChild(inputElement)
        labelElement.appendChild(checkmarkSpanElement)
        labelElement.appendChild(textSpanElement)
        settingsElement.appendChild(labelElement)
      })
    addSettingsEventListener(
      applySettingsElement,
      Array.from(settingsElement.querySelectorAll('input')),
      driverId
    )
  }

  async function hasAuthenticated(): Promise<void> {
    const isBuilding: boolean = await getBuildings()
    if (!isBuilding) {
      // @ts-expect-error bug
      await Homey.alert(Homey.__('settings.buildings.error'))
      return
    }
    generateSelectChildrenElements(
      settings,
      settingsElement,
      applySettingsElement
    )
    generateErrorLog()
    hide(authenticatingElement)
    unhide(authenticatedElement)
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
          if (devices.length > 0) {
            resolve(true)
            return
          }
          resolve(false)
        }
      )
    })
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
        authenticateElement.classList.remove('is-disabled')
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!login) {
          unhide(authenticatingElement)
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
          generateCheckboxChildrenElements(
            settingsAta,
            settingsAtaElement,
            applySettingsAtaElement,
            'melcloud'
          )
          unhide(hasDevicesAtaElement)
        }
      }
    )
  }

  frostProtectionMinimumTemperatureElement.min = String(minMinTemperature)
  frostProtectionMinimumTemperatureElement.max = String(maxMinTemperature)
  frostProtectionMaximumTemperatureElement.min = String(minMaxTemperature)
  frostProtectionMaximumTemperatureElement.max = String(maxMaxTemperature)

  await getHomeySetting(usernameElement)
  await getHomeySetting(passwordElement)
  login()

  authenticateElement.addEventListener('click', (): void => {
    authenticateElement.classList.add('is-disabled')
    login()
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
      async (error: Error, success: boolean): Promise<void> => {
        updateHolidayModeElement.classList.remove('is-disabled')
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
      async (error: Error, success: boolean): Promise<void> => {
        updateFrostProtectionElement.classList.remove('is-disabled')
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
