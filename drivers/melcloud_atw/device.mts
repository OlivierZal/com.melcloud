import { hasClassicZone2, isClassicAtwFacade } from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/capabilities.mts'
import type { EnergyReportConfig } from '../base-report.mts'
import { KILOWATT_TO_WATT } from '../../lib/constants.mts'
import { getLocale } from '../../lib/temporal.mts'
import { HotWaterMode } from '../../types/atw.mts'
import {
  type TargetTemperatureFlowCapabilities,
  operationModeStateFromDevice,
  operationModeZoneFromDevice,
} from '../../types/classic-atw.mts'
import { ClassicMELCloudDevice } from '../classic-device.mts'

const convertFromDeviceMeasurePower =
  (
    tag: 'CurrentEnergyConsumed' | 'CurrentEnergyProduced',
  ): ConvertFromDevice<typeof Classic.DeviceType.Atw> =>
  (data) =>
    data[tag] * KILOWATT_TO_WATT

const convertFromDeviceOperationZone =
  (
    tag: 'OperationModeZone1' | 'OperationModeZone2',
  ): ConvertFromDevice<typeof Classic.DeviceType.Atw> =>
  (data) =>
    operationModeZoneFromDevice[data[tag]]

export default class ClassicMELCloudDeviceAtw extends ClassicMELCloudDevice<
  typeof Classic.DeviceType.Atw
> {
  protected readonly capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<typeof Classic.DeviceType.Atw>,
      ConvertToDevice<typeof Classic.DeviceType.Atw>
    >
  > = {
    hot_water_mode: (value: keyof typeof HotWaterMode) =>
      HotWaterMode[value] === HotWaterMode.forced,
    thermostat_mode: (value: keyof typeof Classic.OperationModeZone) =>
      Classic.OperationModeZone[value],
    'thermostat_mode.zone2': (value: keyof typeof Classic.OperationModeZone) =>
      Classic.OperationModeZone[value],
  }

  protected readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<typeof Classic.DeviceType.Atw>,
      ConvertFromDevice<typeof Classic.DeviceType.Atw>
    >
  > = {
    measure_power: convertFromDeviceMeasurePower('CurrentEnergyConsumed'),
    'measure_power.produced': convertFromDeviceMeasurePower(
      'CurrentEnergyProduced',
    ),
    'target_temperature.flow_cool':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_cool',
        'SetCoolFlowTemperatureZone1',
      ),
    'target_temperature.flow_cool_zone2':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_cool_zone2',
        'SetCoolFlowTemperatureZone2',
      ),
    'target_temperature.flow_heat':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_heat',
        'SetHeatFlowTemperatureZone1',
      ),
    'target_temperature.flow_heat_zone2':
      this.#convertFromDeviceTargetTemperatureFlow(
        'target_temperature.flow_heat_zone2',
        'SetHeatFlowTemperatureZone2',
      ),
    thermostat_mode: convertFromDeviceOperationZone('OperationModeZone1'),
    'thermostat_mode.zone2':
      convertFromDeviceOperationZone('OperationModeZone2'),
    'alarm_generic.defrost': ({ DefrostMode: mode }) => Boolean(mode),
    hot_water_mode: ({ ForcedHotWaterMode: isForced }) =>
      isForced ? HotWaterMode.forced : HotWaterMode.auto,
    legionella: ({ LastLegionellaActivationTime: time }) =>
      Temporal.PlainDate.from(time).toLocaleString(getLocale(this.homey), {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      }),
    operational_state: ({ OperationMode: state }) =>
      operationModeStateFromDevice[state],
  }

  protected override readonly energyReportRegular: EnergyReportConfig = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'regular',
    values: { hour: 1, millisecond: 0, minute: 10, second: 0 },
  }

  protected override readonly energyReportTotal: EnergyReportConfig = {
    duration: { days: 1 },
    interval: { days: 1 },
    minus: { days: 1 },
    mode: 'total',
    values: { hour: 1, millisecond: 0, minute: 5, second: 0 },
  }

  protected override async setCapabilityValues(
    data: Readonly<Classic.ListDeviceData<typeof Classic.DeviceType.Atw>>,
  ): Promise<void> {
    await super.setCapabilityValues(data)
    await this.#setOperationModeStates()
  }

  #convertFromDeviceTargetTemperatureFlow(
    capability: keyof TargetTemperatureFlowCapabilities,
    tag:
      | 'SetCoolFlowTemperatureZone1'
      | 'SetCoolFlowTemperatureZone2'
      | 'SetHeatFlowTemperatureZone1'
      | 'SetHeatFlowTemperatureZone2',
  ): ConvertFromDevice<typeof Classic.DeviceType.Atw> {
    // Fall back to the minimum allowed value when the device reports no
    // usable temperature (zero, NaN, or nullish on the wire despite the
    // number type).
    return (data) => {
      const value = data[tag]
      return value !== 0 && Number.isFinite(value) ?
          value
        : this.getCapabilityOptions(capability).min
    }
  }

  async #setOperationModeStates(): Promise<void> {
    const { facade } = this
    if (facade === undefined || !isClassicAtwFacade(facade)) {
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
    if (
      this.hasCapability('operational_state.zone2') &&
      hasClassicZone2(facade)
    ) {
      await this.setCapabilityValue(
        'operational_state.zone2',
        facade.zone2.operationalState,
      )
    }
  }
}
