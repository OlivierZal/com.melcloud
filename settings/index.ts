import Homey from 'homey/lib/Homey'
import {
  Building,
  ErrorLog,
  ErrorLogQuery,
  FrostProtectionData,
  FrostProtectionSettings,
  HolidayModeData,
  HolidayModeSettings,
  LoginCredentials,
  MELCloudDevice,
  Settings
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady (Homey: Homey): Promise<void> {
  await Homey.ready()

  let to: string = ''
  const limit: number = 29
  const offset: number = 0
  let fromDateHuman: string = ''
  let errorCount: number = 0
  let hasLoadedTableHead: boolean = false
  let hasLoadedBuildings: boolean = false

  const isNotAuthenticatedElement: HTMLDivElement = document.getElementById('is_not_authenticated') as HTMLDivElement
  const usernameElement: HTMLInputElement = document.getElementById('username') as HTMLInputElement
  const passwordElement: HTMLInputElement = document.getElementById('password') as HTMLInputElement
  const authenticateElement: HTMLButtonElement = document.getElementById('authenticate') as HTMLButtonElement
  const isAuthenticatedElement: HTMLDivElement = document.getElementById('is_authenticated') as HTMLDivElement

  const periodElement: HTMLLabelElement = document.getElementById('period') as HTMLLabelElement
  const tableElement: HTMLTableElement | null = document.querySelector('table')
  const fromElement: HTMLInputElement = document.getElementById('from') as HTMLInputElement
  const seeElement: HTMLButtonElement = document.getElementById('see') as HTMLButtonElement

  const intervalElement: HTMLInputElement = document.getElementById('interval') as HTMLInputElement
  const alwaysOnElement: HTMLSelectElement = document.getElementById('always_on') as HTMLSelectElement
  const applyElement: HTMLButtonElement = document.getElementById('apply') as HTMLButtonElement

  const buildingElement: HTMLSelectElement = document.getElementById('building') as HTMLSelectElement
  const holidayModeEnabledElement: HTMLSelectElement = document.getElementById('enabled-holiday-mode') as HTMLSelectElement
  const holidayModeStartDateElement: HTMLInputElement = document.getElementById('start-date') as HTMLInputElement
  const holidayModeEndDateElement: HTMLInputElement = document.getElementById('end-date') as HTMLInputElement
  const refreshHolidayModeElement: HTMLButtonElement = document.getElementById('refresh-holiday-mode') as HTMLButtonElement
  const updateHolidayModeElement: HTMLButtonElement = document.getElementById('update-holiday-mode') as HTMLButtonElement
  const frostProtectionEnabledElement: HTMLSelectElement = document.getElementById('enabled-frost-protection') as HTMLSelectElement
  const frostProtectionMinimumTemperatureElement: HTMLInputElement = document.getElementById('min') as HTMLInputElement
  const frostProtectionMaximumTemperatureElement: HTMLInputElement = document.getElementById('max') as HTMLInputElement
  const refreshFrostProtectionElement: HTMLButtonElement = document.getElementById('refresh-frost-protection') as HTMLButtonElement
  const updateFrostProtectionElement: HTMLButtonElement = document.getElementById('update-frost-protection') as HTMLButtonElement

  function hasAuthenticated (isAuthenticated: boolean = true): void {
    isNotAuthenticatedElement.style.display = !isAuthenticated ? 'block' : 'none'
    isAuthenticatedElement.style.display = isAuthenticated ? 'block' : 'none'
  }

  function generateTableHead (table: HTMLTableElement, keys: string[]): void {
    const thead: HTMLTableSectionElement = table.createTHead()
    const row: HTMLTableRowElement = thead.insertRow()
    for (const key of keys) {
      const th: HTMLTableCellElement = document.createElement('th')
      th.innerText = key
      row.appendChild(th)
    }
    if (!hasLoadedTableHead) {
      hasLoadedTableHead = true
    }
  }

  function generateTable (table: HTMLTableElement, errors: ErrorLog['Errors']): void {
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
      limit: String(limit),
      offset: String(offset)
    }
    const queryString: string = new URLSearchParams(query as Record<string, string>).toString()
    // @ts-expect-error bug
    Homey.api('GET', `/report/error_log?${queryString}`,
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
        periodElement.innerText = `Since ${fromDateHuman}: ${errorCount} ${[0, 1].includes(errorCount) ? 'error' : 'errors'}`
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

  function buildSettingsBody (settings: Array<HTMLInputElement | HTMLSelectElement>): Settings {
    const body: Settings = {}
    for (const setting of settings) {
      if (setting.value !== '') {
        if (['true', 'false'].includes(setting.value)) {
          body[setting.id] = setting.value === 'true'
          continue
        }
        const settingValue: number = Number.parseInt(setting.value)
        body[setting.id] = !Number.isNaN(settingValue) ? settingValue : setting.value
      }
    }
    return body
  }

  function getBuildingHolidayModeSettings (settings?: HolidayModeData): void {
    if (settings !== undefined) {
      holidayModeEnabledElement.value = String(settings.HMEnabled)
      holidayModeStartDateElement.value = settings.HMEnabled ? (settings.HMStartDate ?? '') : ''
      holidayModeEndDateElement.value = settings.HMEnabled ? (settings.HMEndDate ?? '') : ''
      return
    }
    // @ts-expect-error bug
    Homey.api('GET', `/settings/holiday_mode/buildings/${buildingElement.value}`,
      async (error: Error, data: HolidayModeData): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        holidayModeEnabledElement.value = String(data.HMEnabled)
        holidayModeStartDateElement.value = data.HMEnabled ? (data.HMStartDate ?? '') : ''
        holidayModeEndDateElement.value = data.HMEnabled ? (data.HMEndDate ?? '') : ''
      }
    )
  }

  function getBuildingFrostProtectionSettings (settings?: FrostProtectionData): void {
    if (settings !== undefined) {
      frostProtectionEnabledElement.value = String(settings.FPEnabled)
      frostProtectionMinimumTemperatureElement.value = String(settings.FPMinTemperature)
      frostProtectionMaximumTemperatureElement.value = String(settings.FPMaxTemperature)
      return
    }
    // @ts-expect-error bug
    Homey.api('GET', `/settings/frost_protection/buildings/${buildingElement.value}`,
      async (error: Error, data: FrostProtectionData): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        frostProtectionEnabledElement.value = String(data.FPEnabled)
        frostProtectionMinimumTemperatureElement.value = String(data.FPMinTemperature)
        frostProtectionMaximumTemperatureElement.value = String(data.FPMaxTemperature)
      }
    )
  }

  function getBuildings (): void {
    // @ts-expect-error bug
    Homey.api('GET', '/buildings',
      async (error: Error, buildings: Array<Building<MELCloudDevice>>): Promise<void> => {
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
        if (!hasLoadedBuildings) {
          hasLoadedBuildings = true
        }
        const { HMEnabled, HMStartDate, HMEndDate, FPEnabled, FPMinTemperature, FPMaxTemperature } = buildings[0]
        getBuildingHolidayModeSettings({ HMEnabled, HMStartDate, HMEndDate })
        getBuildingFrostProtectionSettings({ FPEnabled, FPMinTemperature, FPMaxTemperature })
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

  // @ts-expect-error bug
  Homey.get('username', async (error: Error, username: string): Promise<void> => {
    if (error !== null) {
      // @ts-expect-error bug
      await Homey.alert(error)
      return
    }
    usernameElement.value = username ?? ''
  })
  // @ts-expect-error bug
  Homey.get('password', async (error: Error, password: string): Promise<void> => {
    if (error !== null) {
      // @ts-expect-error bug
      await Homey.alert(error)
      return
    }
    passwordElement.value = password ?? ''
  })

  load()

  authenticateElement.addEventListener('click', (): void => {
    const body: LoginCredentials = {
      username: usernameElement.value,
      password: passwordElement.value
    }
    // @ts-expect-error bug
    Homey.api('POST', '/login', body,
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
        load()
        // @ts-expect-error bug
        await Homey.set('username', usernameElement.value, async (err: Error): Promise<void> => {
          if (err !== null) {
            // @ts-expect-error bug
            await Homey.alert(err)
          }
        })
        // @ts-expect-error bug
        await Homey.set('password', passwordElement.value, async (err: Error): Promise<void> => {
          if (err !== null) {
            // @ts-expect-error bug
            await Homey.alert(err)
          }
        })
        // @ts-expect-error bug
        await Homey.alert('Authentication succeeded.')
      }
    )
  })

  fromElement.addEventListener('change', (): void => {
    if (to !== '' && fromElement.value !== '' && Date.parse(fromElement.value) > Date.parse(to)) {
      fromElement.value = to
      // @ts-expect-error bug
      Homey.alert(`Choose a date before ${fromDateHuman}.`)
    }
  })

  seeElement.addEventListener('click', (): void => {
    generateErrorLog()
  })

  intervalElement.addEventListener('change', (): void => {
    const interval: number = Number.parseInt(intervalElement.value)
    if (Number.isNaN(interval) || interval < 1 || interval > 60) {
      intervalElement.value = ''
      // @ts-expect-error bug
      Homey.alert('The frequency must be an integer between 1 and 60.')
    }
  })

  applyElement.addEventListener('click', (): void => {
    const body: Settings = buildSettingsBody([intervalElement, alwaysOnElement])
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
        Homey.api('POST', '/settings/devices', body,
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
    } else if (holidayModeEndDateElement.value === '' && holidayModeEnabledElement.value === 'true') {
      holidayModeEnabledElement.value = 'false'
    }
  })

  holidayModeEndDateElement.addEventListener('change', (): void => {
    if (holidayModeEndDateElement.value !== '' && holidayModeEnabledElement.value === 'false') {
      if (holidayModeEnabledElement.value === 'false') {
        holidayModeEnabledElement.value = 'true'
      }
    } else if (holidayModeStartDateElement.value === '' && holidayModeEnabledElement.value === 'true') {
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
    Homey.api('POST', `/settings/holiday_mode/buildings/${buildingElement.value}`, body,
      async (error: Error, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingHolidayModeSettings()
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!success) {
          getBuildingHolidayModeSettings()
          // @ts-expect-error bug
          await Homey.alert('Update failed.')
          return
        }
        getBuildingHolidayModeSettings()
        // @ts-expect-error bug
        await Homey.alert('Update succeeded.')
      }
    )
  })

  frostProtectionMinimumTemperatureElement.addEventListener('change', (): void => {
    if (frostProtectionEnabledElement.value === 'false') {
      frostProtectionEnabledElement.value = 'true'
    }
  })

  frostProtectionMaximumTemperatureElement.addEventListener('change', (): void => {
    if (frostProtectionEnabledElement.value === 'false') {
      frostProtectionEnabledElement.value = 'true'
    }
  })

  refreshFrostProtectionElement.addEventListener('click', (): void => {
    getBuildingFrostProtectionSettings()
  })

  updateFrostProtectionElement.addEventListener('click', (): void => {
    const body: FrostProtectionSettings = {
      Enabled: frostProtectionEnabledElement.value === 'true',
      MinimumTemperature: Number(frostProtectionMinimumTemperatureElement.value),
      MaximumTemperature: Number(frostProtectionMaximumTemperatureElement.value)
    }
    // @ts-expect-error bug
    Homey.api('POST', `/settings/frost_protection/buildings/${buildingElement.value}`, body,
      async (error: Error, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          // @ts-expect-error bug
          await Homey.alert(error.message)
          return
        }
        if (!success) {
          getBuildingFrostProtectionSettings()
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
