import {
  type DeviceAtwFacade,
  type DeviceAtwHasZone2Facade,
  type DeviceType,
  type ListDeviceData,
  OperationModeState,
  OperationModeZone,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'

import type { EnergyReportConfig } from '../base-report.mts'

import { KILOWATT_TO_WATT, keyOfValue } from '../../lib/index.mts'
import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OperationalCapabilities,
  type SetCapabilities,
  type TargetTemperatureFlowCapabilities,
  HotWaterMode,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

const convertFromDeviceMeasurePower: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: number) => value * KILOWATT_TO_WATT

const convertFromDeviceOperationZone: ConvertFromDevice<
  typeof DeviceType.Atw
> = (value: OperationModeZone) => keyOfValue(OperationModeZone, value)

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
    hot_water_mode: (isForced: boolean) =>
      isForced ? HotWaterMode.forced : HotWaterMode.auto,
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
    await this.#setOperationModeStates()
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
  ): ConvertFromDevice<typeof DeviceType.Atw> {
    // A value of 0 means the temperature is unset — fall back to the minimum allowed value
    return (value: number) => value || this.getCapabilityOptions(capability).min
  }

  async #setOperationModeStates(): Promise<void> {
    const { facade } = this
    if (!facade || !('hotWater' in facade)) {
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const atwFacade = facade as DeviceAtwFacade
    await this.setCapabilityValue(
      'operational_state.hot_water',
      atwFacade.hotWater.operationalState,
    )
    await this.setCapabilityValue(
      'operational_state.zone1',
      atwFacade.zone1.operationalState,
    )
    if (this.hasCapability('operational_state.zone2') && 'zone2' in facade) {
      await this.setCapabilityValue(
        'operational_state.zone2',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        (facade as DeviceAtwHasZone2Facade).zone2.operationalState,
      )
    }
  }
}
