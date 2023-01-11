import Homey from 'homey/lib/Homey'
import { Building, ErrorLog, FrostProtectionData, HolidayModeData, MELCloudDevice, Settings } from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady (Homey: Homey): Promise<void> {
  await Homey.ready()

  let hasAuthenticated: boolean = true
  let to: string = ''
  let offset: number = 0
  const limit: number = 30
  let errorCount: number = 0
  let hasLoadedTableHead: boolean = false
  let hasLoadedBuildings: boolean = false

  const periodElement: HTMLLabelElement = document.getElementById('period') as HTMLLabelElement

  const usernameElement: HTMLInputElement = document.getElementById('username') as HTMLInputElement
  const passwordElement: HTMLInputElement = document.getElementById('password') as HTMLInputElement
  const authenticateElement: HTMLButtonElement = document.getElementById('authenticate') as HTMLButtonElement

  const fromElement: HTMLInputElement = document.getElementById('from') as HTMLInputElement
  const viewElement: HTMLButtonElement = document.getElementById('view') as HTMLButtonElement
  const table: HTMLTableElement = document.querySelector('table') as HTMLTableElement

  const intervalElement: HTMLInputElement = document.getElementById('interval') as HTMLInputElement
  const alwaysOnElement: HTMLSelectElement = document.getElementById('always-on') as HTMLSelectElement
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

  function generateTableHead (table: HTMLTableElement, keys: string[]): void {
    const thead: HTMLTableSectionElement = table.createTHead()
    const row: HTMLTableRowElement = thead.insertRow()
    for (const key of keys) {
      const th: HTMLTableCellElement = document.createElement('th')
      const text: Text = document.createTextNode(key)
      th.appendChild(text)
      row.appendChild(th)
    }
    if (!hasLoadedTableHead) {
      hasLoadedTableHead = true
    }
  }

  function generateTable (table: HTMLTableElement, errors: ErrorLog['Errors']): void {
    for (const error of errors) {
      const row: HTMLTableRowElement = table.insertRow()
      for (const value of Object.values(error)) {
        const cell: HTMLTableCellElement = row.insertCell()
        const text: Text = document.createTextNode(value)
        cell.appendChild(text)
      }
    }
  }

  function generateErrorLog (): void {
    // @ts-expect-error
    Homey.api(
      'GET',
      `/report/error_log?from=${fromElement.value}&to=${to}&limit=${limit}&offset=${offset}`,
      async (error: string | null, data: ErrorLog | null): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (data === null) {
          if (hasAuthenticated) {
            hasAuthenticated = false
          }
          // @ts-expect-error
          await Homey.alert('Error log could not be retrieved')
          return
        }
        offset++
        to = data.FromDateMinusOneDay
        errorCount += data.Errors.length
        periodElement.innerText = `From ${data.FromDateHuman} (${errorCount} ${[0, 1].includes(errorCount) ? 'error' : 'errors'})`
        if (data.Errors.length === 0) {
          return
        }
        if (!hasLoadedTableHead) {
          generateTableHead(table, Object.keys(data.Errors[0]))
        }
        generateTable(table, data.Errors)
      }
    )
  }

  function getBuildingHolidayModeSettings (settings?: HolidayModeData): void {
    if (settings !== undefined) {
      holidayModeEnabledElement.value = String(settings.HMEnabled)
      holidayModeStartDateElement.value = settings.HMEnabled ? (settings.HMStartDate ?? '') : ''
      holidayModeEndDateElement.value = settings.HMEnabled ? (settings.HMEndDate ?? '') : ''
      return
    }
    // @ts-expect-error
    Homey.api(
      'GET',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      async (error: string | null, data: HolidayModeData | null): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (data === null) {
          // @ts-expect-error
          await Homey.alert('Holiday mode settings could not be retrieved')
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
    // @ts-expect-error
    Homey.api(
      'GET',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      async (error: string | null, data: FrostProtectionData | null): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (data === null) {
          // @ts-expect-error
          await Homey.alert('Frost protection settings could not be retrieved')
          return
        }
        frostProtectionEnabledElement.value = String(data.FPEnabled)
        frostProtectionMinimumTemperatureElement.value = String(data.FPMinTemperature)
        frostProtectionMaximumTemperatureElement.value = String(data.FPMaxTemperature)
      }
    )
  }

  function getBuildings (): void {
    // @ts-expect-error
    Homey.api(
      'GET',
      '/buildings',
      async (error: string | null, buildings: Array<Building<MELCloudDevice>>): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
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
    generateErrorLog()
    if (!hasLoadedBuildings) {
      getBuildings()
    }
  }

  // @ts-expect-error
  Homey.get('username', async (err: string | null, username: string): Promise<void> => {
    if (err !== null) {
      // @ts-expect-error
      await Homey.alert(err)
      return
    }
    usernameElement.value = username ?? ''
  })
  // @ts-expect-error
  Homey.get('password', async (err: string | null, password: string): Promise<void> => {
    if (err !== null) {
      // @ts-expect-error
      await Homey.alert(err)
      return
    }
    passwordElement.value = password ?? ''
  })
  if (usernameElement.value === '' || passwordElement.value === '') {
    hasAuthenticated = false
  }

  load()

  authenticateElement.addEventListener('click', (): void => {
    // @ts-expect-error
    Homey.api(
      'POST',
      '/login',
      { username: usernameElement.value, password: passwordElement.value },
      async (error: string | null, login: boolean): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (!login) {
          // @ts-expect-error
          await Homey.alert('Authentication failed')
          return
        }
        if (!hasAuthenticated) {
          hasAuthenticated = true
        }
        load()
        // @ts-expect-error
        await Homey.set('username', usernameElement.value, async (err: string | null): Promise<void> => {
          if (err !== null) {
            // @ts-expect-error
            await Homey.alert(err)
          }
        })
        // @ts-expect-error
        await Homey.set('password', passwordElement.value, async (err: string | null): Promise<void> => {
          if (err !== null) {
            // @ts-expect-error
            await Homey.alert(err)
          }
        })
        // @ts-expect-error
        await Homey.alert('Authentication succeeded')
      }
    )
  })

  viewElement.addEventListener('click', (): void => {
    fromElement.value = ''
    generateErrorLog()
  })

  applyElement.addEventListener('click', (): void => {
    const body: Settings = {}
    if (intervalElement.value !== '') {
      const interval: number = Number(intervalElement.value)
      if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
        // @ts-expect-error
        void Homey.alert('The frequency must be an integer between 1 and 60.')
        return
      }
      body.interval = interval
    }
    if (alwaysOnElement.value !== '') {
      body.always_on = alwaysOnElement.value === 'true'
    }
    if (Object.keys(body).length === 0) {
      // @ts-expect-error
      void Homey.alert('No change to apply')
      return
    }
    // @ts-expect-error
    void Homey.confirm(
      'Are you sure you want to override these settings on all devices?',
      null,
      async (error: string | null, ok: boolean): Promise<void> => {
        if (error !== null) {
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (!ok) {
          // @ts-expect-error
          await Homey.alert('Change has not been applied')
          return
        }
        // @ts-expect-error
        Homey.api(
          'POST',
          '/settings/devices',
          body,
          async (error: string | null, success: boolean): Promise<void> => {
            if (error !== null) {
              // @ts-expect-error
              await Homey.alert(error)
              return
            }
            if (!success) {
              // @ts-expect-error
              await Homey.alert('No change to apply')
              return
            }
            // @ts-expect-error
            await Homey.alert('Change has been applied to all devices')
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
  refreshHolidayModeElement.addEventListener('click', (): void => {
    getBuildingHolidayModeSettings()
  })
  updateHolidayModeElement.addEventListener('click', (): void => {
    const Enabled: boolean = holidayModeEnabledElement.value === 'true'
    // @ts-expect-error
    Homey.api(
      'POST',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      {
        Enabled,
        StartDate: Enabled ? holidayModeStartDateElement.value : '',
        EndDate: Enabled ? holidayModeEndDateElement.value : ''
      },
      async (error: string | null, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingHolidayModeSettings()
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (!success) {
          if (Enabled && (holidayModeStartDateElement.value === '' || holidayModeEndDateElement.value === '')) {
            // @ts-expect-error
            await Homey.alert('Start Date and/or End Date are missing')
            return
          }
          if (holidayModeEndDateElement.value < holidayModeStartDateElement.value) {
            // @ts-expect-error
            await Homey.alert('End Date should be greater than Start Date')
            return
          }
          getBuildingHolidayModeSettings()
          // @ts-expect-error
          await Homey.alert('Update failed')
          return
        }
        getBuildingHolidayModeSettings()
        // @ts-expect-error
        await Homey.alert('Update succeeded')
      }
    )
  })

  refreshFrostProtectionElement.addEventListener('click', (): void => {
    getBuildingFrostProtectionSettings()
  })
  updateFrostProtectionElement.addEventListener('click', (): void => {
    // @ts-expect-error
    Homey.api(
      'POST',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      {
        Enabled: frostProtectionEnabledElement.value === 'true',
        MinimumTemperature: frostProtectionMinimumTemperatureElement.value,
        MaximumTemperature: frostProtectionMaximumTemperatureElement.value
      },
      async (error: string | null, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          // @ts-expect-error
          await Homey.alert(error)
          return
        }
        if (!success) {
          getBuildingFrostProtectionSettings()
          // @ts-expect-error
          await Homey.alert('Update failed')
          return
        }
        // @ts-expect-error
        await Homey.alert('Update succeeded')
      }
    )
  })
}
