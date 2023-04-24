import { DateTime } from 'luxon'
import MELCloudDeviceMixin from '../../mixins/device_mixin'
import type MELCloudDriverAtw from './driver'
import {
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
  type Capability,
  type CapabilityValue,
  type ExtendedSetCapability,
  type OperationModeZoneCapability,
  type SetCapabilities,
  type SetCapability
} from '../../types'

const operationModeFromDevice: string[] = [
  'idle',
  'dhw',
  'heating',
  'cooling',
  'defrost',
  'standby',
  'legionella'
]

export default class MELCloudDeviceAtw extends MELCloudDeviceMixin {
  declare driver: MELCloudDriverAtw
  declare diff: SetCapabilities<MELCloudDeviceAtw>

  async onInit(): Promise<void> {
    const { canCool, hasZone2 } = this.getStore()
    this.requiredCapabilities = this.driver.getRequiredCapabilities(
      canCool,
      hasZone2
    )
    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw
    this.reportCapabilityMapping = reportCapabilityMappingAtw
    this.reportPlanParameters = {
      minus: { days: 1 },
      interval: { days: 1 },
      duration: { days: 1 },
      values: { hour: 1, minute: 10, second: 0, millisecond: 0 }
    }
    await super.onInit()
  }

  async specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDeviceAtw>,
    value: CapabilityValue
  ): Promise<void> {
    switch (capability) {
      case 'onoff.forced_hot_water':
        this.diff[capability] = value as boolean
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        await this.handleOperationModeZones(capability, value)
        break
      case 'target_temperature.zone2':
      case 'target_temperature.zone1_flow_cool':
      case 'target_temperature.zone1_flow_heat':
      case 'target_temperature.zone2_flow_cool':
      case 'target_temperature.zone2_flow_heat':
      case 'target_temperature.tank_water':
        this.diff[capability] = value as number
    }
  }

  async handleOperationModeZones(
    capability: OperationModeZoneCapability,
    value: CapabilityValue
  ): Promise<void> {
    this.diff[capability] = value as string
    const { canCool, hasZone2 } = this.getStore()
    if (hasZone2 === true) {
      const zoneValue: number = Number(value)
      const otherZone: OperationModeZoneCapability =
        this.getOtherCapabilityZone(capability) as OperationModeZoneCapability
      let otherZoneValue: number = Number(this.getCapabilityValue(otherZone))
      if (canCool === true) {
        if (zoneValue > 2) {
          if (otherZoneValue < 3) {
            otherZoneValue = Math.min(otherZoneValue + 3, 4)
          }
        } else if (otherZoneValue > 2) {
          otherZoneValue -= 3
        }
      }
      if ([0, 3].includes(zoneValue) && otherZoneValue === zoneValue) {
        otherZoneValue += 1
      }
      this.diff[otherZone] = String(otherZoneValue)
      await this.setDisplayErrorWarning()
    }
  }

  getOtherCapabilityZone(capability: string): string {
    return capability.endsWith('.zone1')
      ? capability.replace(/.zone1$/, '.zone2')
      : capability.replace(/.zone2$/, '.zone1')
  }

  convertToDevice(
    capability: SetCapability<MELCloudDeviceAtw>,
    value: CapabilityValue = this.getCapabilityValue(capability)
  ): boolean | number {
    switch (capability) {
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return Number(value)
      default:
        return super.convertToDevice(capability, value)
    }
  }

  async convertFromDevice(
    capability: Capability<MELCloudDeviceAtw>,
    value: boolean | number | string
  ): Promise<void> {
    let newValue: CapabilityValue = value
    switch (capability) {
      case 'last_legionella':
        newValue = DateTime.fromISO(value as string, {
          locale: this.app.getLanguage()
        }).toLocaleString(DateTime.DATE_HUGE)
        break
      case 'measure_power':
      case 'measure_power.produced':
        ;(newValue as number) *= 1000
        break
      case 'operation_mode_state':
        newValue = operationModeFromDevice[newValue as number]
        break
      case 'operation_mode_state.zone1':
      case 'operation_mode_state.zone2':
        newValue =
          newValue === true
            ? 'idle'
            : this.getCapabilityValue('operation_mode_state')
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        newValue = String(newValue)
        break
      case 'alarm_generic.defrost_mode':
        newValue = Boolean(newValue)
    }
    await this.setCapabilityValue(capability, newValue)
  }
}

module.exports = MELCloudDeviceAtw
