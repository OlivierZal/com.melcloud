import {
  type DeviceType,
  type ListDeviceData,
  type OperationModeState,
  hasZone2,
  isAtwFacade,
  OperationModeZone,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import type { EnergyReportConfig } from '../base-report.mts'
import { KILOWATT_TO_WATT } from '../../lib/index.mts'
import {
  type ClassicTargetTemperatureFlowCapabilities,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OperationalCapabilities,
  type SetCapabilities,
  ClassicHotWaterMode,
  operationModeStateFromDevice,
  operationModeZoneFromDevice,
} from '../../types/index.mts'
import { ClassicMELCloudDevice } from '../classic-base-device.mts'

const convertFromDeviceMeasurePower: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: number) => value * KILOWATT_TO_WATT

const convertFromDeviceOperationZone: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: OperationModeZone) => operationModeZoneFromDevice[value]

export default class ClassicMELCloudDeviceAtw extends ClassicMELCloudDevice<
  typeof DeviceType.Atw
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof DeviceType.Atw>,
      ConvertToDevice<typeof DeviceType.Atw>
    >
  > = {
    hot_water_mode: (value: keyof typeof ClassicHotWaterMode) =>
      ClassicHotWaterMode[value] === ClassicHotWaterMode.forced,
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
    hot_water_mode: (isForced: boolean) =>
      isForced ? ClassicHotWaterMode.forced : ClassicHotWaterMode.auto,
    legionella: (value: string) =>
      DateTime.fromISO(value).toLocaleString({
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }),
    operational_state: (value: OperationModeState) =>
      operationModeStateFromDevice[value],
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
    await this.#setOperationModeStates()
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof ClassicTargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<typeof DeviceType.Atw> {
    // Fall back to the minimum allowed value in case of undefined or null
    return (value: number) => value || this.getCapabilityOptions(capability).min
  }

  async #setOperationModeStates(): Promise<void> {
    const { facade } = this
    if (!facade || !isAtwFacade(facade)) {
      return
    }
    await this.setCapabilityValue(
      'operational_state.hot_water',
      facade.hotWater.operationalState,
    )
    await this.setCapabilityValue(
      'operational_state.zone1',
      facade.zone1.operationalState,
    )
    if (this.hasCapability('operational_state.zone2') && hasZone2(facade)) {
      await this.setCapabilityValue(
        'operational_state.zone2',
        facade.zone2.operationalState,
      )
    }
  }
}
