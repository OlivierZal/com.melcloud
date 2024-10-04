import {
  OperationModeState,
  OperationModeZone,
  type ListDeviceDataAtw,
  type ZoneAtw,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import { BaseMELCloudDevice } from '../../bases/device'
import {
  HotWaterMode,
  K_MULTIPLIER,
  OperationModeStateHotWaterCapability,
  OperationModeStateZoneCapability,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesAtw,
  type ReportPlanParameters,
  type SetCapabilitiesAtw,
  type TargetTemperatureFlowCapabilities,
} from '../../types'

const convertFromDeviceMeasurePower = ((value: number) =>
  value * K_MULTIPLIER) as ConvertFromDevice<'Atw'>

const convertFromDeviceOperationZone = ((value: OperationModeZone) =>
  OperationModeZone[value]) as ConvertFromDevice<'Atw'>

const getOperationModeStateHotWaterValue = (
  data: ListDeviceDataAtw,
  operationModeState: keyof typeof OperationModeState,
): OperationModeStateHotWaterCapability => {
  if (data.ProhibitHotWater) {
    return OperationModeStateHotWaterCapability.prohibited
  }
  if (operationModeState in OperationModeStateHotWaterCapability) {
    return OperationModeStateHotWaterCapability[
      operationModeState as OperationModeStateHotWaterCapability
    ]
  }
  return OperationModeStateHotWaterCapability.idle
}

const getOperationModeStateZoneValue = (
  data: ListDeviceDataAtw,
  operationModeState: keyof typeof OperationModeState,
  zone: ZoneAtw,
): OperationModeStateZoneCapability => {
  if (
    (data[`${zone}InCoolMode`] && data[`ProhibitCooling${zone}`]) ||
    (data[`${zone}InHeatMode`] && data[`ProhibitHeating${zone}`])
  ) {
    return OperationModeStateZoneCapability.prohibited
  }
  if (
    operationModeState in OperationModeStateZoneCapability &&
    !data[`Idle${zone}`]
  ) {
    return OperationModeStateZoneCapability[
      operationModeState as OperationModeStateZoneCapability
    ]
  }
  return OperationModeStateZoneCapability.idle
}

export = class extends BaseMELCloudDevice<'Atw'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAtw, ConvertFromDevice<'Atw'>>
  > = {
    'alarm_generic.defrost': ((value: number) =>
      Boolean(value)) as ConvertFromDevice<'Atw'>,
    hot_water_mode: ((value: boolean) =>
      value ?
        HotWaterMode.forced
      : HotWaterMode.auto) as ConvertFromDevice<'Atw'>,
    legionella: ((value: string) =>
      DateTime.fromISO(value).toLocaleString({
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      })) as ConvertFromDevice<'Atw'>,
    measure_power: convertFromDeviceMeasurePower,
    'measure_power.produced': convertFromDeviceMeasurePower,
    operational_state: ((value: OperationModeState) =>
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
  } as const

  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  } as const

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilitiesAtw, ConvertToDevice<'Atw'>>
  > = {
    hot_water_mode: ((value: keyof typeof HotWaterMode) =>
      value === HotWaterMode.forced) as ConvertToDevice<'Atw'>,
    thermostat_mode: ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
    'thermostat_mode.zone2': ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<'Atw'>,
  } as const

  protected override async setCapabilityValues(
    data: ListDeviceDataAtw,
  ): Promise<void> {
    await super.setCapabilityValues(data)
    await this.#setOperationModeStates(data)
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<'Atw'> {
    return ((value: number) =>
      value ||
      this.getCapabilityOptions(capability).min) as ConvertFromDevice<'Atw'>
  }

  async #setOperationModeStateHotWater(
    data: ListDeviceDataAtw,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    await this.setCapabilityValue(
      'operational_state.hot_water',
      getOperationModeStateHotWaterValue(data, operationModeState),
    )
  }

  async #setOperationModeStateZones(
    data: ListDeviceDataAtw,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    await Promise.all(
      (['Zone1', 'Zone2'] as const).map(async (zone) => {
        const zoneSuffix = zone.toLowerCase() as Lowercase<ZoneAtw>
        if (this.hasCapability(`operational_state.${zoneSuffix}`)) {
          await this.setCapabilityValue(
            `operational_state.${zoneSuffix}`,
            getOperationModeStateZoneValue(data, operationModeState, zone),
          )
        }
      }),
    )
  }

  async #setOperationModeStates(data: ListDeviceDataAtw): Promise<void> {
    const operationModeState = OperationModeState[
      data.OperationMode
    ] as keyof typeof OperationModeState
    await this.#setOperationModeStateHotWater(data, operationModeState)
    await this.#setOperationModeStateZones(data, operationModeState)
  }
}
