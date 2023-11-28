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

enum OperationMode {
  idle = 0,
  dhw = 1,
  heating = 2,
  cooling = 3,
  defrost = 4,
  standby = 5,
  legionella = 6,
}

enum OperationModeZone {
  room = 0,
  flow = 1,
  curve = 2,
  room_cool = 3,
  flow_cool = 4,
}

const getOtherCapabilityZone = (capability: string): string =>
  capability.endsWith('.zone2')
    ? capability.replace(/.zone2$/, '')
    : `${capability}.zone2`

export = class MELCloudDeviceAtw extends BaseMELCloudDevice {
  protected reportPlanParameters: {
    duration: object
    interval: object
    minus: object
    values: object
  } = {
    minus: { days: 1 },
    interval: { days: 1 },
    duration: { days: 1 },
    values: { hour: 1, minute: 10, second: 0, millisecond: 0 },
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
      const zoneValue: number =
        OperationModeZone[value as keyof typeof OperationModeZone]
      const otherZoneCapability: SetCapability<MELCloudDriverAtw> =
        getOtherCapabilityZone(capability) as SetCapability<MELCloudDriverAtw>
      let otherZoneValue: number =
        OperationModeZone[
          this.getRequestedOrCurrentValue(
            otherZoneCapability,
          ) as keyof typeof OperationModeZone
        ]
      if (CanCool) {
        if (zoneValue >= 3) {
          if (otherZoneValue <= 1) {
            otherZoneValue += 3
          } else if (otherZoneValue === 2) {
            otherZoneValue = 3
          }
        } else if (otherZoneValue >= 3) {
          otherZoneValue -= 3
        }
      }
      if ([0, 3].includes(zoneValue) && otherZoneValue === zoneValue) {
        otherZoneValue += 1
      }
      this.diff.set(otherZoneCapability, OperationModeZone[otherZoneValue])
      await this.setDisplayErrorWarning()
    }
  }

  protected convertToDevice(
    capability: SetCapability<MELCloudDriverAtw>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (true) {
      case capability === 'onoff':
        return (this.getSetting('always_on') as boolean)
          ? true
          : (value as boolean)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[value as keyof typeof OperationModeZone]
      default:
        return value as SetDeviceValue
    }
  }

  protected convertFromDevice(
    capability: Capability<MELCloudDriverAtw>,
    value: DeviceValue,
  ): CapabilityValue {
    switch (true) {
      case capability === 'alarm_generic.defrost_mode':
        return !!(value as number)
      case capability === 'last_legionella':
        return DateTime.fromISO(value as string, {
          locale: this.app.getLanguage(),
        }).toLocaleString({
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      case capability.startsWith('measure_power') &&
        capability in (this.driver.reportCapabilityMapping ?? {}):
        return (value as number) * 1000
      case capability === 'operation_mode_state':
        return OperationMode[value as number]
      case capability.startsWith('operation_mode_state.zone'):
        return (value as boolean)
          ? 'idle'
          : (this.getCapabilityValue('operation_mode_state') as string)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[value as number]
      default:
        return value
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
