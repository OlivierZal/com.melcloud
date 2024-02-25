import {
  type DeviceDataAtw,
  type DeviceDataFromListAtw,
  OperationModeState,
  OperationModeZone,
  type SetDeviceDataAtw,
} from '../../melcloud/types'
import type {
  NonEffectiveFlagsValueOf,
  OpCapabilitiesAtw,
  OperationModeZoneCapabilities,
  ReportPlanParameters,
  SetCapabilitiesAtw,
  SetCapabilitiesWithThermostatModeAtw,
  Store,
  TypedString,
} from '../../types'
import type AtwDriver from './driver'
import BaseMELCloudDevice from '../../bases/device'
import { DateTime } from 'luxon'
import { K_MULTIPLIER } from '../../constants'

const ROOM_FLOW_GAP: number = OperationModeZone.flow
const HEAT_COOL_GAP: number = OperationModeZone.room_cool

export = class AtwDevice extends BaseMELCloudDevice<AtwDriver> {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  }

  protected convertFromDevice<K extends keyof OpCapabilitiesAtw>(
    capability: TypedString<K>,
    value:
      | NonEffectiveFlagsValueOf<DeviceDataAtw>
      | NonEffectiveFlagsValueOf<DeviceDataFromListAtw>,
  ): OpCapabilitiesAtw[K] {
    switch (true) {
      case capability === 'alarm_generic.defrost_mode':
        return Boolean(value as number) as OpCapabilitiesAtw[K]
      case capability === 'last_legionella':
        return DateTime.fromISO(value as string, {
          locale: this.homey.i18n.getLanguage(),
        }).toLocaleString({
          day: 'numeric',
          month: 'short',
          weekday: 'short',
        }) as OpCapabilitiesAtw[K]
      case capability === 'measure_power':
      case capability === 'measure_power.produced':
        return ((value as number) * K_MULTIPLIER) as OpCapabilitiesAtw[K]
      case capability === 'operation_mode_state':
        return OperationModeState[
          value as OperationModeState
        ] as OpCapabilitiesAtw[K]
      case capability.startsWith('operation_mode_state.zone'):
        return (
          (value as boolean)
            ? OperationModeState[OperationModeState.idle]
            : this.getCapabilityValue('operation_mode_state')
        ) as OpCapabilitiesAtw[K]
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[
          value as OperationModeZone
        ] as OpCapabilitiesAtw[K]
      case capability === 'target_temperature.flow_cool':
      case capability === 'target_temperature.flow_cool_zone2':
      case capability === 'target_temperature.flow_heat':
      case capability === 'target_temperature.flow_heat_zone2':
        return ((value as number) ||
          this.getCapabilityOptions(capability).min) as OpCapabilitiesAtw[K]
      default:
        return value as OpCapabilitiesAtw[K]
    }
  }

  protected convertToDevice<K extends keyof SetCapabilitiesAtw>(
    capability: K,
    value: SetCapabilitiesAtw[K],
  ): NonEffectiveFlagsValueOf<SetDeviceDataAtw> {
    switch (true) {
      case capability === 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[value as keyof typeof OperationModeZone]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceDataAtw>
    }
  }

  protected handleOperationModeZones<
    K extends keyof OperationModeZoneCapabilities,
  >(capability: K, value: keyof typeof OperationModeZone): void {
    const { canCool, hasZone2 } = this.getStore() as Store
    if (hasZone2) {
      const zoneValue: OperationModeZone = OperationModeZone[value]
      const otherZoneCapability: keyof OperationModeZoneCapabilities = (
        capability.endsWith('.zone2')
          ? capability.replace(/.zone2$/u, '')
          : `${capability}.zone2`
      ) as keyof OperationModeZoneCapabilities
      const otherZoneValue: OperationModeZone = this.#getOtherZoneValue(
        otherZoneCapability,
        zoneValue,
        canCool,
      )
      this.diff.set(
        otherZoneCapability,
        OperationModeZone[otherZoneValue] as keyof typeof OperationModeZone,
      )
    }
  }

  protected specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatModeAtw,
  >(capability: K, value: SetCapabilitiesWithThermostatModeAtw[K]): void {
    if (capability.startsWith('operation_mode_zone')) {
      this.handleOperationModeZones(
        capability as keyof OperationModeZoneCapabilities,
        value as keyof typeof OperationModeZone,
      )
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateThermostatMode(): Promise<void> {
    // Not implemented
  }

  #getOtherZoneValue(
    otherZoneCapability: keyof OperationModeZoneCapabilities,
    zoneValue: OperationModeZone,
    canCool: boolean,
  ): OperationModeZone {
    let otherZoneValue: OperationModeZone =
      OperationModeZone[this.getRequestedOrCurrentValue(otherZoneCapability)]
    if (canCool) {
      if (zoneValue > OperationModeZone.curve) {
        otherZoneValue =
          otherZoneValue === OperationModeZone.curve
            ? HEAT_COOL_GAP
            : otherZoneValue + HEAT_COOL_GAP
      } else if (otherZoneValue > OperationModeZone.curve) {
        otherZoneValue -= HEAT_COOL_GAP
      }
    }
    if (
      [OperationModeZone.room, OperationModeZone.room_cool].includes(
        zoneValue,
      ) &&
      otherZoneValue === zoneValue
    ) {
      otherZoneValue += ROOM_FLOW_GAP
    }
    return otherZoneValue
  }
}
