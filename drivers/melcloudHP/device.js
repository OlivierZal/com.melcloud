const Homey = require('homey')
const axios = require('axios')

class MELCloudHPDevice extends Homey.Device {
  async getOtherZoneFlowTemperatureSettings () {
    const otherSettings = {
      cool_flow_temperature: 0,
      heat_flow_temperature: 0
    }

    const data = this.getData()
    const devices = this.driver.getDevices()
    let dataZone
    if (!data.zone) {
      dataZone = 1
    }
    let otherZoneDevice
    devices.forEach((device) => {
      const otherData = device.getData()
      let otherDataZone
      if (!otherData.zone) {
        otherDataZone = 1
      }
      if (
        otherData.id === data.id &&
        otherData.buildingid === data.buildingid &&
        otherDataZone !== dataZone
      ) {
        otherZoneDevice = this.driver.getDevice(otherData)
      }
    })
    if (otherZoneDevice) {
      otherSettings.cool_flow_temperature = otherZoneDevice.getSetting(
        'cool_flow_temperature'
      )
      otherSettings.heat_flow_temperature = otherZoneDevice.getSetting(
        'heat_flow_temperature'
      )
    }
    return otherSettings
  }

  async onInit () {
    await this.setWarning(
      'Remove and re-add your device to see the energy measurements and take advantage of all the features of Homey! (you will need to update your existing flows once and for all)'
    )
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this))
    this.registerCapabilityListener(
      'target_temperature',
      this.onCapabilityTargetTemperature.bind(this)
    )
    this.registerCapabilityListener(
      'operation_mode_zone',
      this.onCapabilityOperationModeZone.bind(this)
    )
    this.registerCapabilityListener(
      'forced_hot_water',
      this.onCapabilityForcedHotWater.bind(this)
    )
    await this.syncDataFromDevice()
  }

  async syncDataFromDevice () {
    this.homey.clearTimeout(this.syncTimeout)

    const data = this.getData()
    const url = `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`
    const config = {
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') }
    }
    try {
      this.log(`\`${this.getName()}\`: syncing from device...`)
      await axios.get(url, config).then(async (response) => {
        if (response.status !== 200) {
          throw new Error(`\`statusCode\`: ${response.status}`)
        }
        this.log(response.data)
        if (response.data.ErrorMessage) {
          throw new Error(response.data.ErrorMessage)
        }

        // Get data
        let coolFlowTemperature
        let heatFlowTemperature
        let measureTemperature
        let operationModeZone
        let targetTemperature
        if (data.zone === 2) {
          coolFlowTemperature = response.data.SetCoolFlowTemperatureZone2
          heatFlowTemperature = response.data.SetHeatFlowTemperatureZone2
          measureTemperature = response.data.RoomTemperatureZone2
          operationModeZone = String(response.data.OperationModeZone2)
          targetTemperature = response.data.SetTemperatureZone2
        } else {
          coolFlowTemperature = response.data.SetCoolFlowTemperatureZone1
          heatFlowTemperature = response.data.SetHeatFlowTemperatureZone1
          measureTemperature = response.data.RoomTemperatureZone1
          operationModeZone = String(response.data.OperationModeZone1)
          targetTemperature = response.data.SetTemperatureZone1
        }

        // Update capabilities
        await this.setCapabilityValue('onoff', response.data.Power)
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`onoff\` equals to \`${
                response.data.Power
              }\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`
            )
          )

        await this.setCapabilityValue('measure_temperature', measureTemperature)
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`measure_temperature\` equals to \`${measureTemperature}\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`measure_temperature\` has not been set (${error})`
            )
          )

        const minTargetTemperature = 10
        const maxTargetTemperature = 30
        if (targetTemperature < minTargetTemperature) {
          await this.setCapabilityValue(
            'target_temperature',
            minTargetTemperature
          )
            .then(
              this.log(
                `\`${this.getName()}\`: capability \`target_temperature\` equals to \`${minTargetTemperature}\``
              )
            )
            .catch((error) =>
              this.error(
                `\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`
              )
            )
        } else if (targetTemperature > maxTargetTemperature) {
          await this.setCapabilityValue(
            'target_temperature',
            maxTargetTemperature
          )
            .then(
              this.log(
                `\`${this.getName()}\`: capability \`target_temperature\` equals to \`${maxTargetTemperature}\``
              )
            )
            .catch((error) =>
              this.error(
                `\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`
              )
            )
        } else {
          await this.setCapabilityValue('target_temperature', targetTemperature)
            .then(
              this.log(
                `\`${this.getName()}\`: capability \`target_temperature\` equals to \`${targetTemperature}\``
              )
            )
            .catch((error) =>
              this.error(
                `\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`
              )
            )
        }

        await this.setCapabilityValue(
          'watertank_temperature',
          response.data.TankWaterTemperature
        )
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`watertank_temperature\` equals to \`${
                response.data.TankWaterTemperature
              }\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`watertank_temperature\` has not been set (${error})`
            )
          )

        await this.setCapabilityValue(
          'outdoor_temperature',
          response.data.OutdoorTemperature
        )
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`outdoor_temperature\` equals to \`${
                response.data.OutdoorTemperature
              }\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`outdoor_temperature\` has not been set (${error})`
            )
          )

        const oldOperationMode = this.getCapabilityValue(
          'operation_mode_state'
        )
        const operationMode = String(response.data.OperationMode)
        await this.setCapabilityValue('operation_mode_state', operationMode)
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`operation_mode_state\` equals to \`${operationMode}\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`operation_mode_state\` has not been set (${error})`
            )
          )
        if (operationMode !== oldOperationMode) {
          this.driver.triggerOperationMode(this)
        }

        const oldOperationModeZone = this.getCapabilityValue(
          'operation_mode_zone'
        )
        await this.setCapabilityValue('operation_mode_zone', operationModeZone)
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`operation_mode_zone\` equals to \`${operationModeZone}\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`operation_mode_zone\` has not been set (${error})`
            )
          )
        if (operationModeZone !== oldOperationModeZone) {
          this.driver.triggerOperationModeZone(this)
        }

        const oldForcedHotWater = this.getCapabilityValue('forced_hot_water')
        const forcedHotWater = String(response.data.ForcedHotWaterMode)
        await this.setCapabilityValue('forced_hot_water', forcedHotWater)
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`forced_hot_water\` equals to \`${forcedHotWater}\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`forced_hot_water\` has not been set (${error})`
            )
          )
        if (forcedHotWater !== oldForcedHotWater) {
          this.driver.triggerForcedHotWater(this)
        }

        await this.setCapabilityValue(
          'eco_hot_water',
          response.data.EcoHotWater
        )
          .then(
            this.log(
              `\`${this.getName()}\`: capability \`eco_hot_water\` equals to \`${
                response.data.EcoHotWater
              }\``
            )
          )
          .catch((error) =>
            this.error(
              `\`${this.getName()}\`: capability \`eco_hot_water\` has not been set (${error})`
            )
          )

        // Update capabilities from data only available via `ListDevice`
        const deviceList = await this.homey.app.listDevices(
          this.driver.deviceType
        )
        deviceList.forEach(async (device) => {
          if (
            device.DeviceID === data.id &&
            device.BuildingID === data.buildingid
          ) {
            const flowTemperature = device.Device.FlowTemperature
            const oldFlowTemperature =
              this.getCapabilityValue('flow_temperature')
            await this.setCapabilityValue('flow_temperature', flowTemperature)
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`flow_temperature\` equals to \`${flowTemperature}\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`flow_temperature\` has not been set (${error})`
                )
              )
            if (flowTemperature !== oldFlowTemperature) {
              this.driver.triggerFlowTemperature(this)
            }
            const returnTemperature = device.Device.ReturnTemperature
            const oldReturnTemperature =
              this.getCapabilityValue('return_temperature')
            await this.setCapabilityValue(
              'return_temperature',
              returnTemperature
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`return_temperature\` equals to \`${returnTemperature}\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`return_temperature\` has not been set (${error})`
                )
              )
            if (returnTemperature !== oldReturnTemperature) {
              this.driver.triggerReturnTemperature(this)
            }
            await this.setCapabilityValue(
              'defrost_mode',
              Boolean(device.Device.DefrostMode)
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`defrost_mode\` equals to \`${Boolean(
                    device.Device.DefrostMode
                  )}\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`defrost_mode\` has not been set (${error})`
                )
              )

            await this.setCapabilityValue(
              'booster_heater1',
              device.Device.BoosterHeater1Status
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`booster_heater1\` equals to \`${
                    device.Device.BoosterHeater1Status
                  }\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`booster_heater1\` has not been set (${error})`
                )
              )
            await this.setCapabilityValue(
              'booster_heater2',
              device.Device.BoosterHeater2Status
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`booster_heater2\` equals to \`${
                    device.Device.BoosterHeater2Status
                  }\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`booster_heater2\` has not been set (${error})`
                )
              )
            await this.setCapabilityValue(
              'booster_heater2_plus',
              device.Device.BoosterHeater2PlusStatus
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`booster_heater2_plus\` equals to \`${
                    device.Device.BoosterHeater2PlusStatus
                  }\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`booster_heater2_plus\` has not been set (${error})`
                )
              )
            await this.setCapabilityValue(
              'immersion_heater',
              device.Device.ImmersionHeaterStatus
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`immersion_heater\` equals to \`${
                    device.Device.ImmersionHeaterStatus
                  }\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`immersion_heater\` has not been set (${error})`
                )
              )

            await this.setCapabilityValue(
              'heat_pump_frequency',
              device.Device.HeatPumpFrequency
            )
              .then(
                this.log(
                  `\`${this.getName()}\`: capability \`heat_pump_frequency\` equals to \`${
                    device.Device.HeatPumpFrequency
                  }\``
                )
              )
              .catch((error) =>
                this.error(
                  `\`${this.getName()}\`: capability \`heat_pump_frequency\` has not been set (${error})`
                )
              )
          }
        })

        // Update settings
        await this.setSettings({
          cool_flow_temperature: coolFlowTemperature,
          heat_flow_temperature: heatFlowTemperature,
          set_watertank_temperature: response.data.SetTankWaterTemperature
        })
      })

      const interval = this.getSetting('interval')
      this.syncTimeout = this.homey.setTimeout(
        this.syncDataFromDevice.bind(this),
        interval * 60 * 1000
      )
      this.log(
        `\`${this.getName()}\`: sync from device has been successfully completed, next one in ${interval} minutes`
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found`)
      } else {
        this.error(
          `\`${this.getName()}\`: a problem occurred while syncing from device (${error})`
        )
      }
    }
  }

  async syncDeviceFromData () {
    this.homey.clearTimeout(this.syncTimeout)

    const data = this.getData()
    const settings = this.getSettings()
    const otherSettings = this.getOtherZoneFlowTemperatureSettings()
    const ContextKey = this.homey.settings.get('ContextKey')

    let json
    const url = 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw'
    const config = { headers: { 'X-MitsContextKey': ContextKey } }
    if (data.zone === 2) {
      json = {
        DeviceID: data.id,
        EffectiveFlags: 0x1000800010231,
        ForcedHotWaterMode:
          this.getCapabilityValue('forced_hot_water') === 'true',
        HasPendingCommand: true,
        OperationModeZone2: Number(
          this.getCapabilityValue('operation_mode_zone')
        ),
        Power: this.getCapabilityValue('onoff'),
        SetCoolFlowTemperatureZone1: otherSettings.cool_flow_temperature,
        SetCoolFlowTemperatureZone2: settings.cool_flow_temperature,
        SetHeatFlowTemperatureZone1: otherSettings.heat_flow_temperature,
        SetHeatFlowTemperatureZone2: settings.heat_flow_temperature,
        SetTankWaterTemperature: settings.set_watertank_temperature,
        SetTemperatureZone2: this.getCapabilityValue('target_temperature')
      }
    } else {
      json = {
        DeviceID: data.id,
        EffectiveFlags: 0x10002000100a9,
        ForcedHotWaterMode:
          this.getCapabilityValue('forced_hot_water') === 'true',
        HasPendingCommand: true,
        OperationModeZone1: Number(
          this.getCapabilityValue('operation_mode_zone')
        ),
        Power: this.getCapabilityValue('onoff'),
        SetCoolFlowTemperatureZone1: settings.cool_flow_temperature,
        SetCoolFlowTemperatureZone2: otherSettings.cool_flow_temperature,
        SetHeatFlowTemperatureZone1: settings.heat_flow_temperature,
        SetHeatFlowTemperatureZone2: otherSettings.heat_flow_temperature,
        SetTankWaterTemperature: settings.set_watertank_temperature,
        SetTemperatureZone1: this.getCapabilityValue('target_temperature')
      }
    }
    try {
      this.log(`\`${this.getName()}\`: syncing with device...`)
      await axios.post(url, json, config).then((response) => {
        if (response.status !== 200) {
          throw new Error(`\`statusCode\`: ${response.status}`)
        }
        this.log(response.data)
        if (response.data.ErrorMessage) {
          throw new Error(response.data.ErrorMessage)
        }
      })

      this.syncTimeout = this.homey.setTimeout(
        this.syncDataFromDevice.bind(this),
        60 * 1000
      )
      this.log(
        `\`${this.getName()}\`: sync with device has been successfully completed, sync from device in 1 minute`
      )
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found`)
      } else {
        this.error(
          `\`${this.getName()}\`: a problem occurred while syncing with device (${error})`
        )
      }
    }
  }

  async onCapabilityOnOff (isOn) {
    await this.setCapabilityValue('onoff', isOn)
      .then(
        this.log(
          `\`${this.getName()}\`: capability \`onoff\` equals to \`${isOn}\``
        )
      )
      .catch((error) =>
        this.error(
          `\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`
        )
      )
    await this.syncDeviceFromData()
  }

  async onCapabilityTargetTemperature (targetTemperature) {
    await this.setCapabilityValue('target_temperature', targetTemperature)
      .then(
        this.log(
          `\`${this.getName()}\`: capability \`target_temperature\` equals to \`${targetTemperature}\``
        )
      )
      .catch((error) =>
        this.error(
          `\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`
        )
      )
    await this.syncDeviceFromData()
  }

  async onCapabilityOperationModeZone (operationModeZone) {
    await this.setCapabilityValue('operation_mode_zone', operationModeZone)
      .then(
        this.log(
          `\`${this.getName()}\`: capability \`operation_mode_zone\` equals to \`${operationModeZone}\``
        )
      )
      .catch((error) =>
        this.error(
          `\`${this.getName()}\`: capability \`operation_mode_zone\` has not been set (${error})`
        )
      )
    this.driver.triggerOperationModeZone(this)
    await this.syncDeviceFromData()
  }

  async onCapabilityForcedHotWater (forceHotWater) {
    await this.setCapabilityValue('forced_hot_water', forceHotWater)
      .then(
        this.log(
          `\`${this.getName()}\`: capability \`forced_hot_water\` equals to \`${forceHotWater}\``
        )
      )
      .catch((error) =>
        this.error(
          `\`${this.getName()}\`: capability \`forced_hot_water\` has not been set (${error})`
        )
      )
    this.driver.triggerForcedHotWater(this)
    await this.syncDeviceFromData()
  }

  async onSettings () {
    this.homey.clearTimeout(this.syncTimeout)

    this.homey.setTimeout(this.syncDeviceFromData.bind(this), 5 * 1000)

    this.syncTimeout = this.homey.setTimeout(
      this.syncDataFromDevice.bind(this),
      60 * 1000
    )
    this.log(`\`${this.getName()}\`: next sync from device in 1 minute`)
  }
}

module.exports = MELCloudHPDevice
