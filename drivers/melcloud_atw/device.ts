import { DateTime } from 'luxon'
import BaseMELCloudDevice from '../../bases/device'
import {
  ATW_CURVE_VALUE,
  K_MULTIPLIER,
  ATW_ROOM_VALUES,
  ATW_ROOM_FLOW_GAP,
  ATW_HEAT_COOL_GAP,
} from '../../constants'
import type AtwDriver from './driver'
import {
  OperationModeAtw,
  OperationModeZoneAtw,
  type Capability,
  type CapabilityValue,
  type DeviceValue,
  type ReportPlanParameters,
  type SetCapability,
  type SetDeviceValue,
  type Store,
} from '../../types'

const getOtherCapabilityZone = (capability: string): string =>
  capability.endsWith('.zone2')
    ? capability.replace(/.zone2$/, '')
    : `${capability}.zone2`

export = class AtwDevice extends BaseMELCloudDevice {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    minus: { days: 1 },
    interval: { days: 1 },
    duration: { days: 1 },
    values: { hour: 1, minute: 10, second: 0, millisecond: 0 },
  }

  protected async specificOnCapability(
    capability: SetCapability<AtwDriver>,
    value: CapabilityValue,
  ): Promise<void> {
    this.diff.set(capability, value)
    if (capability.startsWith('operation_mode_zone')) {
      await this.handleOperationModeZones(capability, value as string)
    }
  }

  protected async handleOperationModeZones(
    capability: SetCapability<AtwDriver>,
    value: string,
  ): Promise<void> {
    const { canCool, hasZone2 } = this.getStore() as Store
    if (!hasZone2) {
      return
    }
    const zoneValue: number =
      OperationModeZoneAtw[value as keyof typeof OperationModeZoneAtw]
    const otherZoneCapability: SetCapability<AtwDriver> =
      getOtherCapabilityZone(capability) as SetCapability<AtwDriver>
    let otherZoneValue: number =
      OperationModeZoneAtw[
        this.getRequestedOrCurrentValue(
          otherZoneCapability,
        ) as keyof typeof OperationModeZoneAtw
      ]
    if (canCool) {
      if (zoneValue > ATW_CURVE_VALUE) {
        otherZoneValue =
          otherZoneValue === ATW_CURVE_VALUE
            ? ATW_HEAT_COOL_GAP
            : otherZoneValue + ATW_HEAT_COOL_GAP
      } else if (otherZoneValue > ATW_CURVE_VALUE) {
        otherZoneValue -= ATW_HEAT_COOL_GAP
      }
    }
    if (ATW_ROOM_VALUES.includes(zoneValue) && otherZoneValue === zoneValue) {
      otherZoneValue += ATW_ROOM_FLOW_GAP
    }
    this.diff.set(otherZoneCapability, OperationModeZoneAtw[otherZoneValue])
    await this.setDisplayErrorWarning()
  }

  protected convertToDevice(
    capability: SetCapability<AtwDriver>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (true) {
      case capability === 'onoff':
        return (this.getSetting('always_on') as boolean)
          ? true
          : (value as boolean)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZoneAtw[value as keyof typeof OperationModeZoneAtw]
      default:
        return value as SetDeviceValue
    }
  }

  protected convertFromDevice(
    capability: Capability<AtwDriver>,
    value: DeviceValue,
  ): CapabilityValue {
    switch (true) {
      case capability === 'alarm_generic.defrost_mode':
        return !!(value as number)
      case capability === 'last_legionella':
        return DateTime.fromISO(value as string, {
          locale: this.app.getLanguage(),
        }).toLocaleString({ weekday: 'short', day: 'numeric', month: 'short' })
      case ['measure_power', 'measure_power.produced'].includes(capability):
        return (value as number) * K_MULTIPLIER
      case capability === 'operation_mode_state':
        return OperationModeAtw[value as number]
      case capability.startsWith('operation_mode_state.zone'):
        return (value as boolean)
          ? 'idle'
          : (this.getCapabilityValue('operation_mode_state') as string)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZoneAtw[value as number]
      default:
        return value
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented.
  }
}
