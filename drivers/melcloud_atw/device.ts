import MELCloudDeviceMixin from '../../mixins/device_mixin'
import MELCloudDriverAtw from './driver'
import { Data, ListDevice, ReportMapping, Value } from '../../types'

const operationModeFromDevice = {
  0: 'idle',
  1: 'dhw',
  2: 'heating',
  3: 'cooling',
  4: 'defrost',
  5: 'standby',
  6: 'legionella'
} as const

class MELCloudDeviceAtw extends MELCloudDeviceMixin {
  driver!: MELCloudDriverAtw

  async handleCapabilities (): Promise<void> {
    const store = this.getStore()
    const currentCapabilities = this.getCapabilities()

    for (const capability of currentCapabilities) {
      if (!this.requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability)
      }
    }

    for (const capability of this.driver.atwCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability)
      }
    }

    if (store.canCool === true) {
      for (const capability of this.driver.notCoolAtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.coolAtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
    } else {
      for (const capability of this.driver.coolAtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.notCoolAtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
    }

    if (store.hasZone2 === true) {
      for (const capability of this.driver.zone2AtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability)
        }
      }
      if (store.canCool === true) {
        for (const capability of this.driver.notCoolZone2AtwCapabilities) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability)
          }
        }
        for (const capability of this.driver.coolZone2AtwCapabilities) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability)
          }
        }
      } else {
        for (const capability of this.driver.coolZone2AtwCapabilities) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability)
          }
        }
        for (const capability of this.driver.notCoolZone2AtwCapabilities) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability)
          }
        }
      }
    } else {
      for (const capability of this.driver.zone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.coolZone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
      for (const capability of this.driver.notCoolZone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability)
        }
      }
    }

    for (const capability of this.driver.otherAtwCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability)
      }
    }
  }

  registerCapabilityListeners (): void {
    this.registerCapabilityListener('onoff', async (value: boolean) => {
      await this.onCapability('onoff', value)
    })
    this.registerCapabilityListener('onoff.forced_hot_water', async (value: boolean) => {
      await this.onCapability('onoff.forced_hot_water', value)
    })
    this.registerCapabilityListener('target_temperature', async (value: number) => {
      await this.onCapability('target_temperature', value)
    })
    this.registerCapabilityListener('target_temperature.zone1_flow_cool', async (value: number) => {
      await this.onCapability('target_temperature.zone1_flow_cool', value)
    })
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', async (value: number) => {
      await this.onCapability('target_temperature.zone1_flow_heat', value)
    })
    this.registerCapabilityListener('target_temperature.zone2', async (value: number) => {
      await this.onCapability('target_temperature.zone2', value)
    })
    this.registerCapabilityListener('target_temperature.zone2_flow_cool', async (value: number) => {
      await this.onCapability('target_temperature.zone2_flow_cool', value)
    })
    this.registerCapabilityListener('target_temperature.zone2_flow_heat', async (value: number) => {
      await this.onCapability('target_temperature.zone2_flow_heat', value)
    })
    this.registerCapabilityListener('target_temperature.tank_water', async (value: number) => {
      await this.onCapability('target_temperature.tank_water', value)
    })
    this.registerCapabilityListener('operation_mode_zone.zone1', async (value: number) => {
      await this.onCapability('operation_mode_zone.zone1', value)
    })
    this.registerCapabilityListener('operation_mode_zone.zone2', async (value: number) => {
      await this.onCapability('operation_mode_zone.zone2', value)
    })
    this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', async (value: number) => {
      await this.onCapability('operation_mode_zone_with_cool.zone1', value)
    })
    this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', async (value: number) => {
      await this.onCapability('operation_mode_zone_with_cool.zone2', value)
    })
  }

  async runEnergyReports (): Promise<void> {
    const report: { daily: Data, total: Data } = {
      daily: await this.app.reportEnergyCost(this, true),
      total: await this.app.reportEnergyCost(this, false)
    }

    const reportMapping: ReportMapping = {}
    Object.entries(report).forEach((entry) => {
      const [period, data]: [string, Data] = entry
      if (Object.keys(data).length > 0) {
        ['Consumed', 'Produced'].forEach((type) => {
          reportMapping[`meter_power.${period}_${type.toLowerCase()}`] = 0;
          ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
            reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`] = data[`Total${mode}${type}`] as number
            reportMapping[`meter_power.${period}_${type.toLowerCase()}`] += reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`]
          })
        });
        ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
          reportMapping[`meter_power.${period}_cop_${mode.toLowerCase()}`] = data[`Total${mode}Produced`] as number / (data[`Total${mode}Consumed`] as number)
        })
        reportMapping[`meter_power.${period}_cop`] = reportMapping[`meter_power.${period}_produced`] / reportMapping[`meter_power.${period}_consumed`]
      }
    })

    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability, reportMapping[capability])
    }
  }

  async customSyncData (deviceFromList: ListDevice): Promise<void> {
    if (deviceFromList !== null) {
      const store = this.getStore()

      let hasStoreChanged = false
      if (deviceFromList.Device.CanCool !== store.canCool) {
        await this.setStoreValue('canCool', deviceFromList.Device.CanCool)
        hasStoreChanged = true
      }
      if (deviceFromList.Device.HasZone2 !== store.hasZone2) {
        await this.setStoreValue('hasZone2', deviceFromList.Device.HasZone2)
        hasStoreChanged = true
      }

      if (hasStoreChanged) {
        await this.handleCapabilities()
      }
    }
  }

  async onCapability (capability: string, value: Value): Promise<void> {
    this.homey.clearTimeout(this.syncTimeout)

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true) {
          await this.setWarning('Setting `Always On` is activated')
          await this.setWarning(null)
        }
        this.newData[capability] = this.getCapabilityValueToDevice(capability, value)
        break
      default:
        this.newData[capability] = this.getCapabilityValueToDevice(capability, value)
    }

    this.syncTimeout = this.homey.setTimeout(async () => {
      await this.syncDataToDevice(this.newData)
    }, 1 * 1000)
  }

  getCapabilityValueToDevice (capability: string, value?: Value): Value {
    const newValue: Value = value ?? this.getCapabilityValue(capability)
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : newValue
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return Number(newValue)
      default:
        return newValue
    }
  }

  async setCapabilityValueFromDevice (capability: string, value: Value): Promise<void> {
    let newValue: Value = value
    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on') === true && newValue === false) {
          await this.setSettings({ always_on: false })
        }
        break
      case 'operation_mode_state':
        newValue = operationModeFromDevice[newValue as keyof typeof operationModeFromDevice]
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        newValue = String(newValue)
        break
      case 'alarm_generic.defrost_mode':
        newValue = Boolean(newValue)
        break
      default:
    }
    await this.setOrNotCapabilityValue(capability, newValue)
  }
}

module.exports = MELCloudDeviceAtw
