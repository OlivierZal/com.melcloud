import { DateTime } from 'luxon'
import BaseMELCloudDevice from '../../bases/device'
import type MELCloudDriverAtw from './driver'
import type {
  Capability,
  CapabilityValue,
  DeviceValue,
  SetCapability,
  SetDeviceValue,
  Store,
} from '../../types'

const operationModes: readonly string[] = [
  'idle',
  'dhw',
  'heating',
  'cooling',
  'defrost',
  'standby',
  'legionella',
] as const

const operationModeZoneFromDevice: readonly string[] = [
  'room',
  'flow',
  'cool',
  'room_cool',
  'flow_cool',
] as const

function getOtherCapabilityZone(capability: string): string {
  return capability.endsWith('.zone1')
    ? capability.replace(/.zone1$/, '.zone2')
    : capability.replace(/.zone2$/, '.zone1')
}

export = class MELCloudDeviceAtw extends BaseMELCloudDevice {
  public async onInit(): Promise<void> {
    this.reportPlanParameters = {
      minus: { days: 1 },
      interval: { days: 1 },
      duration: { days: 1 },
      values: { hour: 1, minute: 10, second: 0, millisecond: 0 },
    }
    await super.onInit()
  }

  protected async specificOnCapability(
    capability: SetCapability<MELCloudDriverAtw>,
    value: CapabilityValue,
  ): Promise<void> {
    this.diff.set(capability, value)
    if (capability.startsWith('operation_mode_zone')) {
      await this.handleOperationModeZones(capability, value as string)
    }
  }

  protected async handleOperationModeZones(
    capability: SetCapability<MELCloudDriverAtw>,
    value: string,
  ): Promise<void> {
    const { CanCool, HasZone2 } = this.getStore() as Store
    if (HasZone2) {
      const zoneValue: number = operationModeZoneFromDevice.indexOf(value)
      const otherZoneCapability: SetCapability<MELCloudDriverAtw> =
        getOtherCapabilityZone(capability) as SetCapability<MELCloudDriverAtw>
      let otherZoneValue: number = operationModeZoneFromDevice.indexOf(
        this.getRequestedOrCurrentValue(otherZoneCapability) as string,
      )
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
      this.diff.set(
        otherZoneCapability,
        operationModeZoneFromDevice[otherZoneValue],
      )
      await this.setDisplayErrorWarning()
    }
  }

  protected convertToDevice(
    capability: SetCapability<MELCloudDriverAtw>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true ? true : (value as boolean)
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return operationModeZoneFromDevice.indexOf(value as string)
      default:
        return value as SetDeviceValue
    }
  }

  protected convertFromDevice(
    capability: Capability<MELCloudDriverAtw>,
    value: DeviceValue,
  ): CapabilityValue {
    switch (capability) {
      case 'last_legionella':
        return DateTime.fromISO(value as string, {
          locale: this.app.getLanguage(),
        }).toLocaleString(DateTime.DATE_HUGE)
      case 'measure_power':
      case 'measure_power.produced':
        return (value as number) * 1000
      case 'operation_mode_state':
        return operationModes[value as number]
      case 'operation_mode_state.zone1':
      case 'operation_mode_state.zone2':
        return (value as boolean)
          ? 'idle'
          : (this.getCapabilityValue('operation_mode_state') as string)
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return operationModeZoneFromDevice[value as number]
      case 'alarm_generic.defrost_mode':
        return Boolean(value)
      default:
        return value
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
