import { Building, ErrorLog, FrostProtectionData, HolidayModeData, MELCloudDevice } from '../types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function onHomeyReady (Homey: any): void {
  Homey.ready()

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
    function (error: string | null, data: ErrorLog): void {
      if (error !== null) {
        return Homey.alert(error)
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
  Homey.get('username', function (err: string | null, username: string): void {
    if (err !== null) {
      return Homey.alert(err)
    }
    usernameElement.value = username
  })
  Homey.get('password', function (err: string | null, password: string): void {
    if (err !== null) {
      return Homey.alert(err)
    }
    passwordElement.value = password
  })
  saveElement.addEventListener('click', function (): void {
    Homey.api(
      'POST',
      '/login',
      { username: usernameElement.value, password: passwordElement.value },
      function (error: string | null, login: boolean): void {
        if (error !== null) {
          return Homey.alert(error)
        }
        if (!login) {
          return Homey.alert('Authentication failed')
        }
        Homey.set('username', usernameElement.value, function (err: string | null): void {
          if (err !== null) {
            return Homey.alert(err)
          }
        })
        Homey.set('password', passwordElement.value, function (err: string | null): void {
          if (err !== null) {
            return Homey.alert(err)
          }
        })
        return Homey.alert('Authentication succeeded')
      }
    )
  })

  const intervalElement: any = document.getElementById('interval')
  const alwaysOnElement: any = document.getElementById('always-on')
  const applyElement: any = document.getElementById('apply')
  applyElement.addEventListener('click', function (): void {
    const body: any = {}
    if (intervalElement.value !== '') {
      const interval = Number(intervalElement.value)
      if (!Number.isInteger(interval) || interval < 1 || interval > 60) {
        return Homey.alert('The frequency must be an integer between 1 and 60.')
      }
      body.interval = interval
    }
    if (alwaysOnElement.value !== '') {
      body.always_on = alwaysOnElement.value === 'true'
    }
    if (Object.keys(body).length === 0) {
      return Homey.alert('No change to apply')
    }
    Homey.confirm(
      'Are you sure you want to override this setting on all devices?',
      null,
      function (error: string | null, ok: boolean): void {
        if (error !== null) {
          return Homey.alert(error)
        }
        if (!ok) {
          return Homey.alert('Change has not been applied')
        }
        Homey.api(
          'POST',
          '/settings/devices',
          body,
          function (error: string | null, setDeviceSettings: boolean): void {
            if (error !== null) {
              return Homey.alert(error)
            }
            if (!setDeviceSettings) {
              return Homey.alert('No change to apply')
            }
            return Homey.alert('Change has been applied to all devices')
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
      function (error: string | null, data: HolidayModeData): void {
        if (error !== null) {
          return Homey.alert(error)
        }
        if (data === null) {
          return Homey.alert('Holiday mode settings could not be retrieved')
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
      function (error: string | null, data: FrostProtectionData): void {
        if (error !== null) {
          return Homey.alert(error)
        }
        if (data === null) {
          return Homey.alert('Frost protection settings could not be retrieved')
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
    function (error: string | null, buildings: Array<Building<MELCloudDevice>>): void {
      if (error !== null) {
        return Homey.alert(error)
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
      function (error: string | null, data: boolean): void {
        if (error !== null) {
          getBuildingHolidayModeSettings()
          return Homey.alert(error)
        }
        if (!data) {
          if (enabled && (holidayModeStartDateElement.value === '' || holidayModeEndDateElement.value === '')) {
            return Homey.alert('Start Date and/or End Date are missing')
          }
          if (holidayModeEndDateElement.value < holidayModeStartDateElement.value) {
            return Homey.alert('End Date should be greater than Start Date')
          }
          getBuildingHolidayModeSettings()
          return Homey.alert('Update failed')
        }
        getBuildingHolidayModeSettings()
        return Homey.alert('Update succeeded')
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
      function (error: string | null, data: boolean): void {
        if (error !== null) {
          getBuildingFrostProtectionSettings()
          return Homey.alert(error)
        }
        if (!data) {
          getBuildingFrostProtectionSettings()
          return Homey.alert('Update failed')
        }
        return Homey.alert('Update succeeded')
      }
    )
  })
}
