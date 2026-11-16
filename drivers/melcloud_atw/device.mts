import { isClassicAtwFacade } from '@olivierzal/melcloud-api'
import { Temporal } from 'temporal-polyfill'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/classic-capabilities.mts'
import type { EnergyReports } from '../base-device.mts'
import type { EnergyReportConfig } from '../base-report.mts'
import { KILO, UNKNOWN_DATE_PLACEHOLDER } from '../../lib/constants.mts'
import { HotWaterMode } from '../../types/atw.mts'
import {
  type TargetTemperatureFlowCapabilities,
  operationModeZoneFromDevice,
} from '../../types/classic-atw.mts'
import { ClassicMELCloudDevice } from '../classic-device.mts'
import { EnergyReport } from '../classic-report.mts'

// An air-to-water unit's figures are the day before's, and shown all
// day: both reports are one read a night, each device at its own instant
// between 01:30 and 01:55. The hour is a summer- and winter-time safety,
// and must stay one: the day MELCloud closes is not guaranteed to turn
// with the clocks, so the reads keep an hour's margin on midnight. The
// minutes keep them 25 past the :05 where MELCloud Classic leaves reads
// unanswered for minutes (00:05 UK time, 01:05 in Central Europe) and
// short of the top of the hour, where the clocks change. `meter_power`
// is all Homey Energy counts a unit's consumption from, so a night
// without the total is a day at 0 kWh.
const NIGHTLY_ENERGY_REPORT = {
  duration: { days: 1 },
  minus: { days: 1 },
  spread: { minutes: 25 },
  values: { hour: 1, millisecond: 0, minute: 30, second: 0 },
} satisfies Omit<EnergyReportConfig, 'mode'>

const convertFromDeviceMeasurePower =
  (
    tag: 'CurrentEnergyConsumed' | 'CurrentEnergyProduced',
  ): ConvertFromDevice<typeof Classic.DeviceType.Atw> =>
  (data) =>
    data[tag] * KILO

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
  }

  protected override readonly energyReports: EnergyReports = {
    regular: { ...NIGHTLY_ENERGY_REPORT, mode: 'regular' },
    total: { ...NIGHTLY_ENERGY_REPORT, mode: 'total' },
    create: (
      config: EnergyReportConfig,
    ): EnergyReport<typeof Classic.DeviceType.Atw> =>
      new EnergyReport(this, config),
  }

  protected override async syncCapabilityValues(
    facade: Classic.DeviceFacade<typeof Classic.DeviceType.Atw>,
  ): Promise<void> {
    await super.syncCapabilityValues(facade)
    await this.#setFacadeStates(facade)
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
      return value !== 0 && Number.isFinite(value)
        ? value
        : this.getCapabilityOptions(capability).min
    }
  }

  #formatLegionellaDate(epochMs: number | null): string {
    if (epochMs === null) {
      return UNKNOWN_DATE_PLACEHOLDER
    }
    return Temporal.Instant.fromEpochMilliseconds(epochMs)
      .toZonedDateTimeISO(this.homey.clock.getTimezone())
      .toPlainDate()
      .toLocaleString(this.homey.i18n.getLanguage(), {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      })
  }

  // The library-derived reads (see the `Capabilities` note): the
  // top-level state — `null` on out-of-vocabulary wire numbers, which
  // clears the Homey value instead of crashing the sync, like the Home
  // twin — the hot-water and per-zone states, and the legionella
  // instant, whose "never ran" and unparseable markers are the
  // library's `null`.
  async #setFacadeStates(
    facade: Classic.DeviceFacade<typeof Classic.DeviceType.Atw>,
  ): Promise<void> {
    if (!isClassicAtwFacade(facade)) {
      return
    }
    await this.setCapabilityValue('operational_state', facade.operationalState)
    await this.setCapabilityValue(
      'operational_state.hot_water',
      facade.hotWater.operationalState,
    )
    await this.setCapabilityValue(
      'operational_state.zone1',
      facade.zone1.operationalState,
    )
    const { zone2 } = facade
    if (zone2 !== null && this.hasCapability('operational_state.zone2')) {
      await this.setCapabilityValue(
        'operational_state.zone2',
        zone2.operationalState,
      )
    }
    await this.#setLegionellaDate(
      facade.hotWater.lastLegionellaActivationEpochMs,
    )
  }

  async #setLegionellaDate(epochMs: number | null): Promise<void> {
    if (!this.hasCapability('legionella')) {
      return
    }
    await this.setCapabilityValue(
      'legionella',
      this.#formatLegionellaDate(epochMs),
    )
  }
}
