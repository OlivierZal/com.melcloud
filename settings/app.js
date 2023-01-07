// eslint-disable-next-line no-unused-vars
function onHomeyReady (Homey) {
  Homey.ready()

  function generateTableHead (table, data) {
    const thead = table.createTHead()
    const row = thead.insertRow()
    for (const key of data) {
      const th = document.createElement('th')
      const text = document.createTextNode(key)
      th.appendChild(text)
      row.appendChild(th)
    }
  }
  function generateTable (table, data) {
    for (const element of data) {
      const row = table.insertRow()
      for (const key in element) {
        const cell = row.insertCell()
        const text = document.createTextNode(element[key])
        cell.appendChild(text)
      }
    }
  }
  Homey.api(
    'GET',
    '/report/error_log',
    function (error, errorLog) {
      if (error) {
        Homey.alert(error)
      }
      if (errorLog !== null && errorLog.length > 0) {
        const data = Object.keys(errorLog[0])
        const table = document.querySelector('table')
        generateTableHead(table, data)
        generateTable(table, errorLog)
      }
    }
  )

  const usernameElement = document.getElementById('username')
  const passwordElement = document.getElementById('password')
  const saveElement = document.getElementById('save')
  Homey.get('username', function (err, username) {
    if (err) {
      return Homey.alert(err)
    }
    usernameElement.value = username
  })
  Homey.get('password', function (err, password) {
    if (err) {
      return Homey.alert(err)
    }
    passwordElement.value = password
  })
  saveElement.addEventListener('click', function () {
    Homey.api(
      'POST',
      '/login',
      { username: usernameElement.value, password: passwordElement.value },
      function (error, login) {
        if (error) {
          return Homey.alert(error)
        }
        if (login === false) {
          return Homey.alert('Authentication failed')
        }
        Homey.set('username', usernameElement.value, function (err) {
          if (err) {
            return Homey.alert(err)
          }
        })
        Homey.set('password', passwordElement.value, function (err) {
          if (err) {
            return Homey.alert(err)
          }
        })
        return Homey.alert('Authentication succeeded')
      }
    )
  })

  const intervalElement = document.getElementById('interval')
  const alwaysOnElement = document.getElementById('always-on')
  const applyElement = document.getElementById('apply')
  applyElement.addEventListener('click', function () {
    const body = {}
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
      function (error, ok) {
        if (error) {
          return Homey.alert(error)
        }
        if (ok === false) {
          return Homey.alert('Change has not been applied')
        }
        Homey.api(
          'POST',
          '/settings/devices',
          body,
          function (error, setDeviceSettings) {
            if (error) {
              return Homey.alert(error)
            }
            if (setDeviceSettings === false) {
              return Homey.alert('No change to apply')
            }
            return Homey.alert('Change has been applied to all devices')
          }
        )
      }
    )
  })

  const buildingElement = document.getElementById('building')
  const holidayModeEnabledElement = document.getElementById('enabled-holiday-mode')
  const holidayModeStartDateElement = document.getElementById('start-date')
  const holidayModeEndDateElement = document.getElementById('end-date')
  const refreshHolidayModeElement = document.getElementById('refresh-holiday-mode')
  const updateHolidayModeElement = document.getElementById('update-holiday-mode')
  const frostProtectionEnabledElement = document.getElementById('enabled-frost-protection')
  const frostProtectionMinimumTemperatureElement = document.getElementById('min')
  const frostProtectionMaximumTemperatureElement = document.getElementById('max')
  const refreshFrostProtectionElement = document.getElementById('refresh-frost-protection')
  const updateFrostProtectionElement = document.getElementById('update-frost-protection')
  function getBuildingHolidayModeSettings () {
    Homey.api(
      'GET',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      function (error, data) {
        if (error) {
          return Homey.alert(error)
        }
        if (data === null) {
          return Homey.alert('Holiday mode settings could not be retrieved')
        }
        holidayModeEnabledElement.value = String(data.HMEnabled)
        if (data.HMEnabled === true) {
          holidayModeStartDateElement.value = data.HMStartDate ?? ''
          holidayModeEndDateElement.value = data.HMEndDate ?? ''
        } else {
          holidayModeStartDateElement.value = ''
          holidayModeEndDateElement.value = ''
        }
      }
    )
  }
  function getBuildingFrostProtectionSettings () {
    Homey.api(
      'GET',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      function (error, data) {
        if (error) {
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
    function (error, buildings) {
      if (error) {
        return Homey.alert(error)
      }
      for (const [buildingId, buildingName] of Object.entries(buildings)) {
        const option = document.createElement('option')
        option.setAttribute('value', buildingId)
        const optionText = document.createTextNode(buildingName)
        option.appendChild(optionText)
        buildingElement.appendChild(option)
      }
      getBuildingHolidayModeSettings()
      getBuildingFrostProtectionSettings()
    }
  )
  buildingElement.addEventListener('change', function () {
    getBuildingHolidayModeSettings()
    getBuildingFrostProtectionSettings()
  })

  holidayModeEnabledElement.addEventListener('change', function () {
    if (holidayModeEnabledElement.value === 'false') {
      holidayModeStartDateElement.value = ''
      holidayModeEndDateElement.value = ''
    }
  })
  refreshHolidayModeElement.addEventListener('click', function () {
    getBuildingHolidayModeSettings()
  })
  updateHolidayModeElement.addEventListener('click', function () {
    const enabled = holidayModeEnabledElement.value === 'true'
    Homey.api(
      'POST',
      `/settings/holiday_mode/buildings/${buildingElement.value}`,
      {
        enabled,
        startDate: enabled === true ? holidayModeStartDateElement.value : '',
        endDate: enabled === true ? holidayModeEndDateElement.value : ''
      },
      function (error, data) {
        if (error) {
          getBuildingHolidayModeSettings()
          return Homey.alert(error)
        }
        if (data === false) {
          if (enabled && !(holidayModeStartDateElement.value && holidayModeEndDateElement.value)) {
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

  refreshFrostProtectionElement.addEventListener('click', function () {
    getBuildingFrostProtectionSettings()
  })
  updateFrostProtectionElement.addEventListener('click', function () {
    const enabled = frostProtectionEnabledElement.value === 'true'
    Homey.api(
      'POST',
      `/settings/frost_protection/buildings/${buildingElement.value}`,
      {
        enabled,
        minimumTemperature: frostProtectionMinimumTemperatureElement.value,
        maximumTemperature: frostProtectionMaximumTemperatureElement.value
      },
      function (error, data) {
        if (error) {
          getBuildingFrostProtectionSettings()
          return Homey.alert(error)
        }
        if (data === false) {
          getBuildingFrostProtectionSettings()
          return Homey.alert('Update failed')
        }
        return Homey.alert('Update succeeded')
      }
    )
  })
}
