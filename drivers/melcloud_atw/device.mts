import {
  type DeviceType,
  type ListDeviceData,
  type ZoneAtw,
  OperationModeState,
  OperationModeZone,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import type { EnergyReportConfig } from '../base-report.mts'

import { keyOfValue } from '../../lib/index.mts'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OperationalCapabilities,
  type SetCapabilities,
  type TargetTemperatureFlowCapabilities,
  HotWaterMode,
  HotWaterOperationState,
  ZoneOperationState,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

const KILOWATT_TO_WATT = 1000

const isKeyOfHotWaterOperationState = (
  key: string,
): key is keyof typeof HotWaterOperationState => key in HotWaterOperationState

const isKeyOfZoneOperationState = (
  key: string,
): key is keyof typeof ZoneOperationState => key in ZoneOperationState

const convertFromDeviceMeasurePower: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: number) => value * KILOWATT_TO_WATT

const convertFromDeviceOperationZone: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: OperationModeZone) => keyOfValue(OperationModeZone, value)

const getOperationModeStateHotWaterValue = (
  data: ListDeviceData<typeof DeviceType.Atw>,
  operationModeState: keyof typeof OperationModeState,
): HotWaterOperationState => {
  if (data.ForcedHotWaterMode) {
    return HotWaterOperationState.dhw
  }
  if (data.ProhibitHotWater) {
    return HotWaterOperationState.prohibited
  }
  if (isKeyOfHotWaterOperationState(operationModeState)) {
    return HotWaterOperationState[operationModeState]
  }
  return HotWaterOperationState.idle
}

/*
 * Determines the operational state of an ATW zone. A zone is 'prohibited'
 * when its heating/cooling mode is active but blocked by prohibition settings
 */
const getOperationModeStateZoneValue = (
  data: ListDeviceData<typeof DeviceType.Atw>,
  operationModeState: keyof typeof OperationModeState,
  zone: ZoneAtw,
): ZoneOperationState => {
  if (
    (data[`${zone}InCoolMode`] && data[`ProhibitCooling${zone}`]) ||
    (data[`${zone}InHeatMode`] && data[`ProhibitHeating${zone}`])
  ) {
    return ZoneOperationState.prohibited
  }
  if (isKeyOfZoneOperationState(operationModeState) && !data[`Idle${zone}`]) {
    return ZoneOperationState[operationModeState]
  }
  return ZoneOperationState.idle
}

export default class MELCloudDeviceAtw extends BaseMELCloudDevice<
  typeof DeviceType.Atw
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Atw>,
      ConvertToDevice<typeof DeviceType.Atw>
    >
  > = {
    hot_water_mode: (value: keyof typeof HotWaterMode) =>
      HotWaterMode[value] === HotWaterMode.forced,
    thermostat_mode: (value: keyof typeof OperationModeZone) =>
      OperationModeZone[value],
    'thermostat_mode.zone2': (value: keyof typeof OperationModeZone) =>
      OperationModeZone[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof DeviceType.Atw>,
      ConvertFromDevice<typeof DeviceType.Atw>
    >
  > = {
    'alarm_generic.defrost': Boolean as ConvertFromDevice<
      typeof DeviceType.Atw
    >,
    measure_power: convertFromDeviceMeasurePower,
    'measure_power.produced': convertFromDeviceMeasurePower,
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
    hot_water_mode: (value: boolean) =>
      value ? HotWaterMode.forced : HotWaterMode.auto,
    legionella: (value: string) =>
      DateTime.fromISO(value).toLocaleString({
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }),
    operational_state: (value: OperationModeState) =>
      keyOfValue(OperationModeState, value),
  }

  protected readonly energyReportRegular: EnergyReportConfig = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'regular',
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  }

  protected readonly energyReportTotal: EnergyReportConfig = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  }

  protected readonly thermostatMode = null

  protected override async setCapabilityValues(
    data: ListDeviceData<typeof DeviceType.Atw>,
  ): Promise<void> {
    await super.setCapabilityValues(data)
    await this.#setOperationModeStates(data)
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<typeof DeviceType.Atw> {
    // A value of 0 means the temperature is unset — fall back to the minimum allowed value
    return (value: number) => value || this.getCapabilityOptions(capability).min
  }

  async #setOperationModeStateHotWater(
    data: ListDeviceData<typeof DeviceType.Atw>,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    await this.setCapabilityValue(
      'operational_state.hot_water',
      getOperationModeStateHotWaterValue(data, operationModeState),
    )
  }

  async #setOperationModeStates(
    data: ListDeviceData<typeof DeviceType.Atw>,
  ): Promise<void> {
    const operationModeState = keyOfValue(
      OperationModeState,
      data.OperationMode,
    )
    await this.#setOperationModeStateHotWater(data, operationModeState)
    await this.#setOperationModeStateZones(data, operationModeState)
  }

  async #setOperationModeStateZones(
    data: ListDeviceData<typeof DeviceType.Atw>,
    operationModeState: keyof typeof OperationModeState,
  ): Promise<void> {
    await Promise.all(
      (['Zone1', 'Zone2'] as const).map(async (zone) => {
        const zoneSuffix = zone === 'Zone1' ? 'zone1' : 'zone2'
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
