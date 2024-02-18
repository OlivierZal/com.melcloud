import BaseMELCloudDevice, { K_MULTIPLIER } from '../../bases/device'
import type {
  DeviceDataFromList,
  NonEffectiveFlagsValueOf,
  OpCapabilities,
  OperationModeZoneCapabilities,
  ReportPlanParameters,
  SetCapabilities,
  SetDeviceData,
  Store,
  TypedString,
} from '../../types/types'
import {
  OperationModeState,
  OperationModeZone,
} from '../../types/MELCloudAPITypes'
import type AtwDriver from './driver'
import { DateTime } from 'luxon'

const ROOM_FLOW_GAP: number = OperationModeZone.flow
const HEAT_COOL_GAP: number = OperationModeZone.room_cool

export = class AtwDevice extends BaseMELCloudDevice<AtwDriver> {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  }

  protected async specificOnCapability<
    K extends keyof SetCapabilities<AtwDriver>,
  >(capability: K, value: SetCapabilities<AtwDriver>[K]): Promise<void> {
    this.diff.set(capability, value)
    if (capability.startsWith('operation_mode_zone')) {
      await this.handleOperationModeZones(
        capability as keyof OperationModeZoneCapabilities,
        value as keyof typeof OperationModeZone,
      )
    }
  }

  protected async handleOperationModeZones<
    K extends keyof OperationModeZoneCapabilities,
  >(capability: K, value: keyof typeof OperationModeZone): Promise<void> {
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
      await this.setDisplayErrorWarning()
    }
  }

  protected convertToDevice<K extends keyof SetCapabilities<AtwDriver>>(
    capability: K,
    value: SetCapabilities<AtwDriver>[K],
  ): NonEffectiveFlagsValueOf<SetDeviceData<AtwDriver>> {
    switch (true) {
      case capability === 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[value as keyof typeof OperationModeZone]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceData<AtwDriver>>
    }
  }

  protected convertFromDevice<K extends keyof OpCapabilities<AtwDriver>>(
    capability: TypedString<K>,
    value: NonEffectiveFlagsValueOf<DeviceDataFromList<AtwDriver>>,
  ): OpCapabilities<AtwDriver>[K] {
    switch (true) {
      case capability === 'alarm_generic.defrost_mode':
        return Boolean(value as number) as OpCapabilities<AtwDriver>[K]
      case capability === 'last_legionella':
        return DateTime.fromISO(value as string, {
          locale: this.homey.i18n.getLanguage(),
        }).toLocaleString({
          day: 'numeric',
          month: 'short',
          weekday: 'short',
        }) as OpCapabilities<AtwDriver>[K]
      case capability === 'measure_power':
      case capability === 'measure_power.produced':
        return ((value as number) *
          K_MULTIPLIER) as OpCapabilities<AtwDriver>[K]
      case capability === 'operation_mode_state':
        return OperationModeState[
          value as OperationModeState
        ] as OpCapabilities<AtwDriver>[K]
      case capability.startsWith('operation_mode_state.zone'):
        return (
          (value as boolean)
            ? OperationModeState[OperationModeState.idle]
            : this.getCapabilityValue('operation_mode_state')
        ) as OpCapabilities<AtwDriver>[K]
      case capability.startsWith('operation_mode_zone'):
        return OperationModeZone[
          value as OperationModeZone
        ] as OpCapabilities<AtwDriver>[K]
      default:
        return value as OpCapabilities<AtwDriver>[K]
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected updateThermostatMode = async (): Promise<void> => {
    // Not implemented.
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
