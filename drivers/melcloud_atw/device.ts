import {
  type ConvertFromDevice,
  type ConvertToDevice,
  K_MULTIPLIER,
  type OpCapabilitiesAtw,
  OperationModeStateHotWaterCapability,
  OperationModeStateZoneCapability,
  type ReportPlanParameters,
  type SetCapabilitiesAtw,
  type TargetTemperatureFlowCapabilities,
  type Zone,
} from '../../types'
import { OperationModeState, OperationModeZone } from '@olivierzal/melcloud-api'
import BaseMELCloudDevice from '../../bases/device'
import { DateTime } from 'luxon'

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
    operation_mode_zone: convertFromDeviceOperationZone,
    'operation_mode_zone.zone2': convertFromDeviceOperationZone,
    operation_mode_zone_with_cool: convertFromDeviceOperationZone,
    'operation_mode_zone_with_cool.zone2': convertFromDeviceOperationZone,
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
    operation_mode_zone: ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
    'operation_mode_zone.zone2': ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
    operation_mode_zone_with_cool: ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
    'operation_mode_zone_with_cool.zone2': ((
      value: keyof typeof OperationModeZone,
    ) => OperationModeZone[value]) as ConvertToDevice<'Atw'>,
  }

  protected override onCapability(
    capability: keyof SetCapabilitiesAtw,
    value: SetCapabilitiesAtw[keyof SetCapabilitiesAtw],
  ): void {
    if (capability.startsWith('operation_mode_zone')) {
      this.diff.set(capability, value)
      return
    }
    super.onCapability(capability, value)
  }

  protected override async setCapabilities(): Promise<void> {
    await super.setCapabilities()
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
    let value = OperationModeStateHotWaterCapability.idle
    if (this.getCapabilityValue('boolean.prohibit_hot_water')) {
      value = OperationModeStateHotWaterCapability.prohibited
    } else if (operationModeState in OperationModeStateHotWaterCapability) {
      value =
        OperationModeStateHotWaterCapability[
          operationModeState as OperationModeStateHotWaterCapability
        ]
    }
    await this.setCapabilityValue('operation_mode_state.hot_water', value)
  }

  async #setOperationModeStateZone(
    zone: Zone,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    if (this.hasCapability(`operation_mode_state.${zone}`)) {
      let value = OperationModeStateZoneCapability.idle
      if (
        (this.getCapabilityValue(`boolean.cooling_${zone}`) &&
          this.getCapabilityValue(`boolean.prohibit_cooling_${zone}`)) ||
        (this.getCapabilityValue(`boolean.heating_${zone}`) &&
          this.getCapabilityValue(`boolean.prohibit_heating_${zone}`))
      ) {
        value = OperationModeStateZoneCapability.prohibited
      } else if (
        operationModeState in OperationModeStateZoneCapability &&
        !this.getCapabilityValue(`boolean.idle_${zone}`)
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
      (['zone1', 'zone2'] as Zone[]).map(async (zone) => {
        await this.#setOperationModeStateZone(zone, operationModeState)
      }),
    )
  }
}
