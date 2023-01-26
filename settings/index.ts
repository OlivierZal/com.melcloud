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
  type Settings
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady (Homey: Homey): Promise<void> {
  await Homey.ready()

  const minimumTemperature: number = 10
  const maximumTemperature: number = 38

  const applySettingsElement: HTMLButtonElement = document.getElementById(
    'apply-settings'
  ) as HTMLButtonElement
  const authenticateElement: HTMLButtonElement = document.getElementById(
    'authenticate'
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

  const periodElement: HTMLLabelElement = document.getElementById(
    'period'
  ) as HTMLLabelElement

  const usernameElement: HTMLInputElement = document.getElementById(
    'username'
  ) as HTMLInputElement
  const passwordElement: HTMLInputElement = document.getElementById(
    'password'
  ) as HTMLInputElement
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
  const intervalElement: HTMLInputElement = document.getElementById(
    'interval'
  ) as HTMLInputElement

  const alwaysOnElement: HTMLSelectElement = document.getElementById(
    'always_on'
  ) as HTMLSelectElement
  const buildingElement: HTMLSelectElement = document.getElementById(
    'building'
  ) as HTMLSelectElement
  const frostProtectionEnabledElement: HTMLSelectElement =
    document.getElementById('enabled-frost-protection') as HTMLSelectElement
  const holidayModeEnabledElement: HTMLSelectElement = document.getElementById(
    'enabled-holiday-mode'
  ) as HTMLSelectElement

  const tableElement: HTMLTableElement | null = document.querySelector('table')

  let hasLoadedTableHead: boolean = false
  let hasLoadedBuildings: boolean = false
  let errorCount: number = 0
  let fromDateHuman: string = ''
  let to: string = ''

  function getHomeySetting (
    element: HTMLInputElement | HTMLSelectElement,
    defaultValue: any = ''
  ): void {
    // @ts-expect-error bug
    Homey.get(element.id, async (error: Error, value: any): Promise<void> => {
      if (error !== null) {
        // @ts-expect-error bug
        await Homey.alert(error.message)
        return
      }
      element.value = String(value ?? defaultValue)
    })
  }

  function hasAuthenticated (isAuthenticated: boolean = true): void {
    isAuthenticatedElement.style.display = isAuthenticated ? 'block' : 'none'
    isNotAuthenticatedElement.style.display = !isAuthenticated
      ? 'block'
      : 'none'
  }

  function generateTableHead (table: HTMLTableElement, keys: string[]): void {
    const thead: HTMLTableSectionElement = table.createTHead()
    const row: HTMLTableRowElement = thead.insertRow()
    for (const key of keys) {
      const th: HTMLTableCellElement = document.createElement('th')
      th.innerText = key
      row.appendChild(th)
    }
    hasLoadedTableHead = true
  }

  function generateTable (
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

  function generateErrorLog (): void {
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
          hasAuthenticated(false)
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        fromDateHuman = data.FromDateHuman
        fromElement.value = data.NextFromDate
        to = data.NextToDate
        errorCount += data.Errors.length
        periodElement.innerText = `Since ${fromDateHuman}: ${errorCount} ${
          [0, 1].includes(errorCount) ? 'error' : 'errors'
        }`
        if (data.Errors.length === 0) {
          return
        }
        if (tableElement !== null) {
          if (!hasLoadedTableHead) {
            generateTableHead(tableElement, Object.keys(data.Errors[0]))
          }
          generateTable(tableElement, data.Errors)
        }
      }
    )
  }

  function int (
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
        `${element.name} must be an integer between ${element.min} and ${element.max}.`
      )
    }
    return value
  }

  function buildSettingsBody (
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
        } else if (['true', 'false'].includes(setting.value)) {
          body[setting.id] = setting.value === 'true'
        } else {
          body[setting.id] = setting.value
        }
      }
    }
    return body
  }

  function getBuildingHolidayModeSettings (settings?: HolidayModeData): void {
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

  function getBuildingFrostProtectionSettings (
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

  function getBuildings (): void {
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
          return
        }
        hasLoadedBuildings = true
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
      }
    )
  }

  function load (): void {
    hasAuthenticated()
    generateErrorLog()
    if (!hasLoadedBuildings) {
      getBuildings()
    }
  }

  frostProtectionMinimumTemperatureElement.min = String(minimumTemperature)
  frostProtectionMinimumTemperatureElement.max = String(maximumTemperature)
  frostProtectionMaximumTemperatureElement.min = String(minimumTemperature)
  frostProtectionMaximumTemperatureElement.max = String(maximumTemperature)
  intervalElement.min = '1'
  intervalElement.max = '60'

  getHomeySetting(usernameElement)
  getHomeySetting(passwordElement)
  load()

  authenticateElement.addEventListener('click', (): void => {
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
          await Homey.alert('Authentication failed.')
          return
        }
        // @ts-expect-error bug
        await Homey.alert('Authentication succeeded.')
        load()
      }
    )
  })

  fromElement.addEventListener('change', (): void => {
    if (
      to !== '' &&
      fromElement.value !== '' &&
      Date.parse(fromElement.value) > Date.parse(to)
    ) {
      fromElement.value = to
      // @ts-expect-error bug
      Homey.alert(`Choose a date before ${fromDateHuman}.`)
    }
  })

  seeElement.addEventListener('click', (): void => {
    generateErrorLog()
  })

  applySettingsElement.addEventListener('click', (): void => {
    let body: Settings = {}
    try {
      body = buildSettingsBody([intervalElement, alwaysOnElement])
    } catch (error: unknown) {
      // @ts-expect-error bug
      Homey.alert(error.message)
      return
    }
    if (Object.keys(body).length === 0) {
      // @ts-expect-error bug
      Homey.alert('No change to apply.')
      return
    }
    // @ts-expect-error bug
    Homey.confirm(
      'Are you sure you want to override these settings on all devices?',
      null,
      async (error: Error, ok: boolean): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!ok) {
          // @ts-expect-error bug
          await Homey.alert('Change has not been applied.')
          return
        }
        // @ts-expect-error bug
        Homey.api(
          'POST',
          '/settings',
          body,
          async (error: Error, success: boolean): Promise<void> => {
            if (error !== null) {
              // @ts-expect-error bug
              await Homey.alert(error.message)
              return
            }
            if (!success) {
              // @ts-expect-error bug
              await Homey.alert('No change to apply.')
              return
            }
            // @ts-expect-error bug
            await Homey.alert('Change has been applied to all devices.')
          }
        )
      }
    )
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
          await Homey.alert('Update failed.')
          return
        }
        // @ts-expect-error bug
        await Homey.alert('Update succeeded.')
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
      Homey.alert(error.message)
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
          await Homey.alert('Update failed.')
          return
        }
        // @ts-expect-error bug
        await Homey.alert('Update succeeded.')
      }
    )
  })
}
