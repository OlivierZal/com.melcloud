import Homey from 'homey/lib/Homey'
import { Building, ErrorLog, FrostProtectionData, HolidayModeData, MELCloudDevice, Settings } from '../types'

type ExtendedHomey = Homey & {
  api: (method: 'GET' | 'POST', path: string, body: any, callback: (error: string | null, data: any) => Promise<void>) => Homey.ManagerApi
  get: (name: string, callback: (error: string | null, value: string) => Promise<void>) => string
  set: (name: string, value: string, callback: (error: string | null) => Promise<void>) => Promise<void>
  alert: (message: string) => Promise<void>
  confirm: (message: string, icon: string | null, callback: (error: string | null, ok: boolean) => Promise<void>) => Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady (Homey: ExtendedHomey): Promise<void> {
  await Homey.ready()

  const usernameElement: HTMLInputElement = document.getElementById('username') as HTMLInputElement
  const passwordElement: HTMLInputElement = document.getElementById('password') as HTMLInputElement
  const intervalElement: HTMLInputElement = document.getElementById('interval') as HTMLInputElement
  const alwaysOnElement: HTMLInputElement = document.getElementById('always-on') as HTMLInputElement
  const buildingElement: HTMLInputElement = document.getElementById('building') as HTMLInputElement
  const holidayModeEnabledElement: HTMLInputElement = document.getElementById('enabled-holiday-mode') as HTMLInputElement
  const holidayModeStartDateElement: HTMLInputElement = document.getElementById('start-date') as HTMLInputElement
  const holidayModeEndDateElement: HTMLInputElement = document.getElementById('end-date') as HTMLInputElement
  const frostProtectionEnabledElement: HTMLInputElement = document.getElementById('enabled-frost-protection') as HTMLInputElement
  const frostProtectionMinimumTemperatureElement: HTMLInputElement = document.getElementById('min') as HTMLInputElement
  const frostProtectionMaximumTemperatureElement: HTMLInputElement = document.getElementById('max') as HTMLInputElement

  const saveElement: HTMLButtonElement = document.getElementById('save') as HTMLButtonElement
  const applyElement: HTMLButtonElement = document.getElementById('apply') as HTMLButtonElement
  const refreshHolidayModeElement: HTMLButtonElement = document.getElementById('refresh-holiday-mode') as HTMLButtonElement
  const updateHolidayModeElement: HTMLButtonElement = document.getElementById('update-holiday-mode') as HTMLButtonElement
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
  }
  function generateTable (table: HTMLTableElement, data: ErrorLog): void {
    for (const error of data) {
      const row: HTMLTableRowElement = table.insertRow()
      for (const value of Object.values(error)) {
        const cell: HTMLTableCellElement = row.insertCell()
        const text: Text = document.createTextNode(value)
        cell.appendChild(text)
      }
    }
  }
  function getBuildingHolidayModeSettings (settings?: HolidayModeData): void {
    if (settings !== undefined) {
      holidayModeEnabledElement.value = String(settings.HMEnabled)
      if (settings.HMEnabled) {
        holidayModeStartDateElement.value = settings.HMStartDate ?? ''
        holidayModeEndDateElement.value = settings.HMEndDate ?? ''
      } else {
        holidayModeStartDateElement.value = ''
        holidayModeEndDateElement.value = ''
      }
      return
    }
    Homey.api(
      'GET',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      null,
      async (error: string | null, data: HolidayModeData): Promise<void> => {
        if (error !== null) {
          await Homey.alert(error)
          return
        }
        if (data === null) {
          await Homey.alert('Holiday mode settings could not be retrieved')
          return
        }
        holidayModeEnabledElement.value = String(data.HMEnabled)
        if (data.HMEnabled) {
          holidayModeStartDateElement.value = data.HMStartDate ?? ''
          holidayModeEndDateElement.value = data.HMEndDate ?? ''
        } else {
          holidayModeStartDateElement.value = ''
          holidayModeEndDateElement.value = ''
        }
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
    Homey.api(
      'GET',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      null,
      async (error: string | null, data: FrostProtectionData): Promise<void> => {
        if (error !== null) {
          await Homey.alert(error)
          return
        }
        if (data === null) {
          await Homey.alert('Frost protection settings could not be retrieved')
          return
        }
        frostProtectionEnabledElement.value = String(data.FPEnabled)
        frostProtectionMinimumTemperatureElement.value = String(data.FPMinTemperature)
        frostProtectionMaximumTemperatureElement.value = String(data.FPMaxTemperature)
      }
    )
  }

  Homey.api(
    'GET',
    '/report/error_log',
    null,
    async (error: string | null, data: ErrorLog): Promise<void> => {
      if (error !== null) {
        await Homey.alert(error)
        return
      }
      if (data === null || data.length === 0) {
        return
      }
      const table: HTMLTableElement = document.querySelector('table') as HTMLTableElement
      generateTableHead(table, Object.keys(data[0]))
      generateTable(table, data)
    }
  )

  Homey.get('username', async (err: string | null, username: string): Promise<void> => {
    if (err !== null) {
      await Homey.alert(err)
      return
    }
    usernameElement.value = username
  })
  Homey.get('password', async (err: string | null, password: string): Promise<void> => {
    if (err !== null) {
      await Homey.alert(err)
      return
    }
    passwordElement.value = password
  })
  saveElement.addEventListener('click', (): void => {
    Homey.api(
      'POST',
      '/login',
      { username: usernameElement.value, password: passwordElement.value },
      async (error: string | null, login: boolean): Promise<void> => {
        if (error !== null) {
          await Homey.alert(error)
          return
        }
        if (!login) {
          await Homey.alert('Authentication failed')
          return
        }
        await Homey.set('username', usernameElement.value, async (err: string | null): Promise<void> => {
          if (err !== null) {
            await Homey.alert(err)
          }
        })
        await Homey.set('password', passwordElement.value, async (err: string | null): Promise<void> => {
          if (err !== null) {
            await Homey.alert(err)
          }
        })
        await Homey.alert('Authentication succeeded')
      }
    )
  })

  applyElement.addEventListener('click', (): void => {
    const body: Settings = {}
    if (intervalElement.value !== '') {
      const interval: number = Number(intervalElement.value)
      if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
        void Homey.alert('The frequency must be an integer between 1 and 60.')
        return
      }
      body.interval = interval
    }
    if (alwaysOnElement.value !== '') {
      body.always_on = alwaysOnElement.value === 'true'
    }
    if (Object.keys(body).length === 0) {
      void Homey.alert('No change to apply')
      return
    }
    void Homey.confirm(
      'Are you sure you want to override these settings on all devices?',
      null,
      async (error: string | null, ok: boolean): Promise<void> => {
        if (error !== null) {
          await Homey.alert(error)
          return
        }
        if (!ok) {
          await Homey.alert('Change has not been applied')
          return
        }
        Homey.api(
          'POST',
          '/settings/devices',
          body,
          async (error: string | null, success: boolean): Promise<void> => {
            if (error !== null) {
              await Homey.alert(error)
              return
            }
            if (!success) {
              await Homey.alert('No change to apply')
              return
            }
            await Homey.alert('Change has been applied to all devices')
          }
        )
      }
    )
  })

  Homey.api(
    'GET',
    '/buildings',
    null,
    async (error: string | null, buildings: Array<Building<MELCloudDevice>>): Promise<void> => {
      if (error !== null) {
        await Homey.alert(error)
        return
      }
      for (const building of buildings) {
        const { ID, Name } = building
        const option = document.createElement('option')
        option.setAttribute('value', String(ID))
        const optionText = document.createTextNode(Name)
        option.appendChild(optionText)
        buildingElement.appendChild(option)
      }
      const { HMEnabled, HMStartDate, HMEndDate, FPEnabled, FPMinTemperature, FPMaxTemperature } = buildings[0]
      getBuildingHolidayModeSettings({ HMEnabled, HMStartDate, HMEndDate })
      getBuildingFrostProtectionSettings({ FPEnabled, FPMinTemperature, FPMaxTemperature })
    }
  )
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
    const enabled: boolean = holidayModeEnabledElement.value === 'true'
    Homey.api(
      'POST',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      {
        enabled,
        startDate: enabled ? holidayModeStartDateElement.value : '',
        endDate: enabled ? holidayModeEndDateElement.value : ''
      },
      async (error: string | null, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingHolidayModeSettings()
          await Homey.alert(error)
          return
        }
        if (!success) {
          if (enabled && (holidayModeStartDateElement.value === '' || holidayModeEndDateElement.value === '')) {
            await Homey.alert('Start Date and/or End Date are missing')
            return
          }
          if (holidayModeEndDateElement.value < holidayModeStartDateElement.value) {
            await Homey.alert('End Date should be greater than Start Date')
            return
          }
          getBuildingHolidayModeSettings()
          await Homey.alert('Update failed')
          return
        }
        getBuildingHolidayModeSettings()
        await Homey.alert('Update succeeded')
      }
    )
  })

  refreshFrostProtectionElement.addEventListener('click', (): void => {
    getBuildingFrostProtectionSettings()
  })
  updateFrostProtectionElement.addEventListener('click', (): void => {
    Homey.api(
      'POST',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      {
        enabled: frostProtectionEnabledElement.value === 'true',
        minimumTemperature: frostProtectionMinimumTemperatureElement.value,
        maximumTemperature: frostProtectionMaximumTemperatureElement.value
      },
      async (error: string | null, success: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          await Homey.alert(error)
          return
        }
        if (!success) {
          getBuildingFrostProtectionSettings()
          await Homey.alert('Update failed')
          return
        }
        await Homey.alert('Update succeeded')
      }
    )
  })
}
