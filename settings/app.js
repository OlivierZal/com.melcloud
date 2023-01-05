// eslint-disable-next-line no-unused-vars
function onHomeyReady (Homey) {
  Homey.ready()

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
    if (intervalElement.value !== '0') {
      if (intervalElement.value < 1 || intervalElement.value > 60) {
        return Homey.alert('The frequency must be between 1 and 60.')
      }
      body.interval = Number(intervalElement.value)
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
          function (error, setSettings) {
            if (error) {
              return Homey.alert(error)
            }
            if (setSettings === false) {
              return Homey.alert('No change to apply')
            }
            return Homey.alert('Change has been applied to all devices')
          }
        )
      }
    )
  })

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
        const table = document.querySelector('table')
        const data = Object.keys(errorLog[0])
        generateTableHead(table, data)
        generateTable(table, errorLog)
      }
    }
  )
}
