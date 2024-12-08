import {
  OperationModeState,
  OperationModeZone,
  type DeviceType,
  type ListDeviceData,
  type ZoneAtw,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import { K_MULTIPLIER } from '../../constants.mts'
import {
  HotWaterMode,
  OperationModeStateHotWaterCapability,
  OperationModeStateZoneCapability,
  type TargetTemperatureFlowCapabilities,
} from '../../types/atw.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

import { EnergyReportRegularAtw } from './reports/regular.mts'
import { EnergyReportTotalAtw } from './reports/total.mts'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OpCapabilities,
  SetCapabilities,
} from '../../types/common.mts'

const convertFromDeviceMeasurePower = ((value: number) =>
  value * K_MULTIPLIER) as ConvertFromDevice<DeviceType.Atw>

const convertFromDeviceOperationZone = ((value: OperationModeZone) =>
  OperationModeZone[value]) as ConvertFromDevice<DeviceType.Atw>

const getOperationModeStateHotWaterValue = (
  data: ListDeviceData<DeviceType.Atw>,
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
  data: ListDeviceData<DeviceType.Atw>,
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

export default class MELCloudDeviceAtw extends BaseMELCloudDevice<DeviceType.Atw> {
  protected readonly EnergyReportRegular = EnergyReportRegularAtw

  protected readonly EnergyReportTotal = EnergyReportTotalAtw

  protected readonly fromDevice: Partial<
    Record<
      keyof OpCapabilities<DeviceType.Atw>,
      ConvertFromDevice<DeviceType.Atw>
    >
  > = {
    'alarm_generic.defrost': ((value: number) =>
      Boolean(value)) as ConvertFromDevice<DeviceType.Atw>,
    hot_water_mode: ((value: boolean) =>
      value ?
        HotWaterMode.forced
      : HotWaterMode.auto) as ConvertFromDevice<DeviceType.Atw>,
    legionella: ((value: string) =>
      DateTime.fromISO(value).toLocaleString({
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      })) as ConvertFromDevice<DeviceType.Atw>,
    measure_power: convertFromDeviceMeasurePower,
    'measure_power.produced': convertFromDeviceMeasurePower,
    operational_state: ((value: OperationModeState) =>
      OperationModeState[value]) as ConvertFromDevice<DeviceType.Atw>,
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

  protected readonly thermostatMode = null

  protected readonly toDevice: Partial<
    Record<
      keyof SetCapabilities<DeviceType.Atw>,
      ConvertToDevice<DeviceType.Atw>
    >
  > = {
    hot_water_mode: ((value: keyof typeof HotWaterMode) =>
      value === HotWaterMode.forced) as ConvertToDevice<DeviceType.Atw>,
    thermostat_mode: ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<DeviceType.Atw>,
    'thermostat_mode.zone2': ((value: keyof typeof OperationModeZone) =>
      OperationModeZone[value]) as ConvertToDevice<DeviceType.Atw>,
  } as const

  protected override async setCapabilityValues(
    data: ListDeviceData<DeviceType.Atw>,
  ): Promise<void> {
    await super.setCapabilityValues(data)
    await this.#setOperationModeStates(data)
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<DeviceType.Atw> {
    return ((value: number) =>
      value ||
      this.getCapabilityOptions(capability)
        .min) as ConvertFromDevice<DeviceType.Atw>
  }

  async #setOperationModeStateHotWater(
    data: ListDeviceData<DeviceType.Atw>,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    await this.setCapabilityValue(
      'operational_state.hot_water',
      getOperationModeStateHotWaterValue(data, operationModeState),
    )
  }

  async #setOperationModeStates(
    data: ListDeviceData<DeviceType.Atw>,
  ): Promise<void> {
    const operationModeState = OperationModeState[
      data.OperationMode
    ] as keyof typeof OperationModeState
    await this.#setOperationModeStateHotWater(data, operationModeState)
    await this.#setOperationModeStateZones(data, operationModeState)
  }

  async #setOperationModeStateZones(
    data: ListDeviceData<DeviceType.Atw>,
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
}
