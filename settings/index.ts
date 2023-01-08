import Homey from 'homey/lib/Homey'
import { Building, ErrorLog, FrostProtectionData, HolidayModeData, MELCloudDevice } from '../types'

type ExtendedHomey = Homey & {
  alert: (message: string) => Promise<void>
  api: (method: 'GET' | 'POST', path: string, body: any, callback: (error: string | null, data: any) => Promise<void>) => Homey.ManagerApi
  confirm: (message: string, icon: string | null, callback: (error: string | null, ok: boolean) => Promise<void>) => Promise<void>
  get: (name: string, callback: (error: string | null, value: string) => Promise<void>) => string
  set: (name: string, value: string, callback: (error: string | null) => Promise<void>) => Promise<void>
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function onHomeyReady (Homey: ExtendedHomey): Promise<void> {
  await Homey.ready()

  function generateTableHead (table: any, keys: string[]): void {
    const thead = table.createTHead()
    const row = thead.insertRow()
    for (const key of keys) {
      const th = document.createElement('th')
      const text = document.createTextNode(key)
      th.appendChild(text)
      row.appendChild(th)
    }
  }
  function generateTable (table: any, data: ErrorLog): void {
    for (const error of data) {
      const row = table.insertRow()
      for (const value of Object.values(error)) {
        const cell = row.insertCell()
        const text = document.createTextNode(value)
        cell.appendChild(text)
      }
    }
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
      const table = document.querySelector('table')
      generateTableHead(table, Object.keys(data[0]))
      generateTable(table, data)
    }
  )

  const usernameElement: any = document.getElementById('username')
  const passwordElement: any = document.getElementById('password')
  const saveElement: any = document.getElementById('save')
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
  saveElement.addEventListener('click', function (): void {
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

  const intervalElement: any = document.getElementById('interval')
  const alwaysOnElement: any = document.getElementById('always-on')
  const applyElement: any = document.getElementById('apply')
  applyElement.addEventListener('click', async (): Promise<void> => {
    const body: any = {}
    if (intervalElement.value !== '') {
      const interval = Number(intervalElement.value)
      if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
        await Homey.alert('The frequency must be an integer between 1 and 60.')
        return
      }
      body.interval = interval
    }
    if (alwaysOnElement.value !== '') {
      body.always_on = alwaysOnElement.value === 'true'
    }
    if (Object.keys(body).length === 0) {
      await Homey.alert('No change to apply')
      return
    }
    await Homey.confirm(
      'Are you sure you want to override this setting on all devices?',
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
          async (error: string | null, setDeviceSettings: boolean): Promise<void> => {
            if (error !== null) {
              await Homey.alert(error)
              return
            }
            if (!setDeviceSettings) {
              await Homey.alert('No change to apply')
              return
            }
            await Homey.alert('Change has been applied to all devices')
          }
        )
      }
    )
  })

  const buildingElement: any = document.getElementById('building')
  const holidayModeEnabledElement: any = document.getElementById('enabled-holiday-mode')
  const holidayModeStartDateElement: any = document.getElementById('start-date')
  const holidayModeEndDateElement: any = document.getElementById('end-date')
  const refreshHolidayModeElement: any = document.getElementById('refresh-holiday-mode')
  const updateHolidayModeElement: any = document.getElementById('update-holiday-mode')
  const frostProtectionEnabledElement: any = document.getElementById('enabled-frost-protection')
  const frostProtectionMinimumTemperatureElement: any = document.getElementById('min')
  const frostProtectionMaximumTemperatureElement: any = document.getElementById('max')
  const refreshFrostProtectionElement: any = document.getElementById('refresh-frost-protection')
  const updateFrostProtectionElement: any = document.getElementById('update-frost-protection')
  function getBuildingHolidayModeSettings (): void {
    Homey.api(
      'GET',
      `/settings/holiday_mode/buildings/${buildingElement.value as number}`,
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
  function getBuildingFrostProtectionSettings (): void {
    Homey.api(
      'GET',
      `/settings/frost_protection/buildings/${buildingElement.value as number}`,
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
        frostProtectionMinimumTemperatureElement.value = data.FPMinTemperature
        frostProtectionMaximumTemperatureElement.value = data.FPMaxTemperature
      }
    )
  }
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
      getBuildingHolidayModeSettings()
      getBuildingFrostProtectionSettings()
    }
  )
  buildingElement.addEventListener('change', function (): void {
    getBuildingHolidayModeSettings()
    getBuildingFrostProtectionSettings()
  })

  holidayModeEnabledElement.addEventListener('change', function (): void {
    if (holidayModeEnabledElement.value === 'false') {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })
  refreshHolidayModeElement.addEventListener('click', function (): void {
    getBuildingHolidayModeSettings()
  })
  updateHolidayModeElement.addEventListener('click', function (): void {
    const enabled = holidayModeEnabledElement.value === 'true'
    Homey.api(
      'POST',
      `/settings/holiday_mode/buildings/${buildingElement.value as number}`,
      {
        enabled,
        startDate: enabled ? holidayModeStartDateElement.value : '',
        endDate: enabled ? holidayModeEndDateElement.value : ''
      },
      async (error: string | null, data: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingHolidayModeSettings()
          await Homey.alert(error)
          return
        }
        if (!data) {
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

  refreshFrostProtectionElement.addEventListener('click', function (): void {
    getBuildingFrostProtectionSettings()
  })
  updateFrostProtectionElement.addEventListener('click', function (): void {
    const enabled = frostProtectionEnabledElement.value === 'true'
    Homey.api(
      'POST',
      `/settings/frost_protection/buildings/${buildingElement.value as number}`,
      {
        enabled,
        minimumTemperature: frostProtectionMinimumTemperatureElement.value,
        maximumTemperature: frostProtectionMaximumTemperatureElement.value
      },
      async (error: string | null, data: boolean): Promise<void> => {
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          await Homey.alert(error)
          return
        }
        if (!data) {
          getBuildingFrostProtectionSettings()
          await Homey.alert('Update failed')
          return
        }
        await Homey.alert('Update succeeded')
      }
    )
  })
}
