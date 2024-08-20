import { OperationModeState, OperationModeZone } from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import BaseMELCloudDevice from '../../bases/device'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesAtw,
  type ReportPlanParameters,
  type SetCapabilitiesAtw,
  type TargetTemperatureFlowCapabilities,
  type Zone,
  K_MULTIPLIER,
  OperationModeStateHotWaterCapability,
  OperationModeStateZoneCapability,
} from '../../types'

const convertFromDeviceMeasurePower = ((value: number) =>
  value * K_MULTIPLIER) as ConvertFromDevice<'Atw'>

const convertFromDeviceOperationZone = ((value: OperationModeZone) =>
  OperationModeZone[value]) as ConvertFromDevice<'Atw'>

export = class extends BaseMELCloudDevice<'Atw'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAtw, ConvertFromDevice<'Atw'>>
  > = {
    'alarm_generic.defrost': ((value: number) =>
      Boolean(value)) as ConvertFromDevice<'Atw'>,
    legionella: ((value: string) =>
      DateTime.fromISO(value, {
        locale: this.homey.i18n.getLanguage(),
      }).toLocaleString({
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      })) as ConvertFromDevice<'Atw'>,
    measure_power: convertFromDeviceMeasurePower,
    'measure_power.produced': convertFromDeviceMeasurePower,
    operation_mode_state: ((value: OperationModeState) =>
      OperationModeState[value]) as ConvertFromDevice<'Atw'>,
    'target_temperature.flow_cool':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_cool',
      ),
    'target_temperature.flow_cool_zone2':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_cool_zone2',
      ),
    'target_temperature.flow_heat':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_heat',
      ),
    'target_temperature.flow_heat_zone2':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_heat_zone2',
      ),
    thermostat_mode: convertFromDeviceOperationZone,
    'thermostat_mode.zone2': convertFromDeviceOperationZone,
  }

  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  }

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesAtw, ConvertToDevice<'Atw'>>
  > = {
    thermostat_mode: ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
    'thermostat_mode.zone2': ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
  }

  protected override async setCapabilityValues(): Promise<void> {
    await super.setCapabilityValues()
    await this.#setOperationModeStates()
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<'Atw'> {
    return ((value: number) =>
      value ||
      this.getCapabilityOptions(capability).min) as ConvertFromDevice<'Atw'>
  }

  async #setOperationModeStateHotWater(
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    if (this.device) {
      let value = OperationModeStateHotWaterCapability.idle
      if (this.device.data.ProhibitHotWater) {
        value = OperationModeStateHotWaterCapability.prohibited
      } else if (operationModeState in OperationModeStateHotWaterCapability) {
        value =
          OperationModeStateHotWaterCapability[
            operationModeState as OperationModeStateHotWaterCapability
          ]
      }
      await this.setCapabilityValue('operation_mode_state.hot_water', value)
    }
  }

  async #setOperationModeStateZone(
    zone: Zone,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    if (this.device && this.hasCapability(`operation_mode_state.${zone}`)) {
      const zoneName = zone === 'zone1' ? 'Zone1' : 'Zone2'
      let value = OperationModeStateZoneCapability.idle
      if (
        (this.device.data[`${zoneName}InCoolMode`] &&
          this.device.data[`ProhibitCooling${zoneName}`]) ||
        (this.device.data[`${zoneName}InHeatMode`] &&
          this.device.data[`ProhibitHeating${zoneName}`])
      ) {
        value = OperationModeStateZoneCapability.prohibited
      } else if (
        operationModeState in OperationModeStateZoneCapability &&
        !this.device.data[`Idle${zoneName}`]
      ) {
        value =
          OperationModeStateZoneCapability[
            operationModeState as OperationModeStateZoneCapability
          ]
      }
      await this.setCapabilityValue(`operation_mode_state.${zone}`, value)
    }
  }

  async #setOperationModeStates(): Promise<void> {
    const operationModeState = this.getCapabilityValue('operation_mode_state')
    await this.#setOperationModeStateHotWater(operationModeState)
    await Promise.all(
      (['zone1', 'zone2'] as const).map(async (zone) => {
        await this.#setOperationModeStateZone(zone, operationModeState)
      }),
    )
  }
}
