import { DateTime } from 'luxon'
import BaseMELCloudDevice from '../../bases/device'
import type MELCloudDriverAtw from './driver'
import type {
  Capability,
  CapabilityValue,
  ExtendedSetCapability,
  SetCapability,
  Store,
} from '../../types'

const operationModeFromDevice: string[] = [
  'idle',
  'dhw',
  'heating',
  'cooling',
  'defrost',
  'standby',
  'legionella',
]

function getOtherCapabilityZone(capability: string): string {
  return capability.endsWith('.zone1')
    ? capability.replace(/.zone1$/, '.zone2')
    : capability.replace(/.zone2$/, '.zone1')
}

export = class MELCloudDeviceAtw extends BaseMELCloudDevice {
  declare driver: MELCloudDriverAtw

  declare diff: Map<SetCapability<MELCloudDriverAtw>, CapabilityValue>

  async onInit(): Promise<void> {
    this.reportPlanParameters = {
      minus: { days: 1 },
      interval: { days: 1 },
      duration: { days: 1 },
      values: { hour: 1, minute: 10, second: 0, millisecond: 0 },
    }
    await super.onInit()
  }

  async specificOnCapability(
    capability: ExtendedSetCapability<MELCloudDriverAtw>,
    value: CapabilityValue
  ): Promise<void> {
    this.diff.set(capability, value)
    if (capability.startsWith('operation_mode_zone')) {
      await this.handleOperationModeZones(capability, value)
    }
  }

  async handleOperationModeZones(
    capability: ExtendedSetCapability<MELCloudDriverAtw>,
    value: CapabilityValue
  ): Promise<void> {
    const { CanCool, HasZone2 } = this.getStore() as Store
    if (HasZone2) {
      const zoneValue = Number(value)
      const otherZone: ExtendedSetCapability<MELCloudDriverAtw> =
        getOtherCapabilityZone(
          capability
        ) as ExtendedSetCapability<MELCloudDriverAtw>
      let otherZoneValue = Number(this.getCapabilityValue(otherZone))
      if (CanCool) {
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
      this.diff.set(otherZone, String(otherZoneValue))
      await this.setDisplayErrorWarning()
    }
  }

  convertToDevice(
    capability: SetCapability<MELCloudDriverAtw>,
    value: CapabilityValue = this.getCapabilityValue(
      capability
    ) as CapabilityValue
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
    capability: Capability<MELCloudDriverAtw>,
    value: boolean | number | string
  ): Promise<void> {
    let newValue: CapabilityValue = value
    switch (capability) {
      case 'last_legionella':
        newValue = DateTime.fromISO(value as string, {
          locale: this.app.getLanguage(),
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
        newValue = newValue
          ? 'idle'
          : (this.getCapabilityValue('operation_mode_state') as string)
        break
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        newValue = String(newValue)
        break
      case 'alarm_generic.defrost_mode':
        newValue = !!newValue
        break
      default:
    }
    await this.setCapabilityValue(capability, newValue)
  }

  // eslint-disable-next-line class-methods-use-this
  async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
