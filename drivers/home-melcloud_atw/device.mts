import type * as Home from '@olivierzal/melcloud-api/home'

import type { HomeEnergyMeasureName } from '../../types/device.mts'
import type {
  HomeCapabilitiesAtw,
  HomeSetCapabilitiesAtw,
} from '../../types/home-atw.mts'
import type {
  HomeConvertFromDevice,
  HomeConvertToDevice,
} from '../../types/home.mts'
import type { EnergyReportConfig } from '../base-report.mts'
import { HotWaterMode } from '../../types/atw.mts'
import { HomeMELCloudDevice } from '../home-device.mts'
import { HomeEnergyReportAtw } from '../home-report-atw.mts'

type AtwType = typeof Home.DeviceType.Atw

export default class HomeMELCloudDeviceAtw extends HomeMELCloudDevice<AtwType> {
  // The zone modes and operational states need no conversion: the facade
  // already exposes the normalized vocabularies the capabilities use.
  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAtw, HomeConvertToDevice<AtwType>>
  > = {
    hot_water_mode: (value: keyof typeof HotWaterMode) =>
      HotWaterMode[value] === HotWaterMode.forced,
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAtw,
    HomeConvertFromDevice<AtwType>
  > = {
    hot_water_mode: ({ forcedHotWaterMode: isForced }) =>
      isForced ? HotWaterMode.forced : HotWaterMode.auto,
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperatureZone1 }) => roomTemperatureZone1,
    'measure_temperature.tank_water': ({ tankWaterTemperature }) =>
      tankWaterTemperature,
    'measure_temperature.zone2': ({ roomTemperatureZone2 }) =>
      roomTemperatureZone2,
    onoff: ({ power: isOn }) => isOn,
    operational_state: ({ operationalState }) => operationalState,
    'operational_state.hot_water': ({ hotWaterOperationalState }) =>
      hotWaterOperationalState,
    'operational_state.zone1': ({ operationalStateZone1 }) =>
      operationalStateZone1,
    'operational_state.zone2': ({ operationalStateZone2 }) =>
      operationalStateZone2,
    target_temperature: ({ setTemperatureZone1: temperature }) => temperature,
    'target_temperature.tank_water': ({
      setTankWaterTemperature: temperature,
    }) => temperature,
    'target_temperature.zone2': ({ setTemperatureZone2: temperature }) =>
      temperature,
    thermostat_mode: ({ operationModeZone1 }) => operationModeZone1,
    'thermostat_mode.zone2': ({ operationModeZone2 }) => operationModeZone2,
  }

  // Near-live power derives from minute buckets: a 5-minute cadence keeps
  // it fresh without hammering the telemetry endpoint; meters accrue hourly
  // at hh:05 like the Classic reports.
  protected override readonly energyReportRegular: EnergyReportConfig = {
    duration: { minutes: 5 },
    mode: 'regular',
    values: { millisecond: 0, second: 0 },
  }

  protected override readonly energyReportTotal: EnergyReportConfig = {
    duration: { hours: 1 },
    mode: 'total',
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected override readonly createEnergyReport = (
    config: EnergyReportConfig,
  ): HomeEnergyReportAtw => new HomeEnergyReportAtw(this, config)

  // Consumed-side capabilities need a consumption estimate or meter,
  // produced-side ones a production estimate or meter; COP needs both.
  protected override isCapabilitySupported(capability: string): boolean {
    if (!super.isCapabilitySupported(capability)) {
      return false
    }
    const measures = this.driver.tagMappings.energy[capability]
    return (
      measures === undefined ||
      measures.every((measure) => this.#supportsMeasure(measure))
    )
  }

  #supportsMeasure(measure: HomeEnergyMeasureName): boolean {
    const capabilities = this.cachedFacade?.capabilities
    if (capabilities === undefined) {
      return false
    }
    return measure === 'consumed' ?
        capabilities.hasEstimatedEnergyConsumption ||
          capabilities.hasMeasuredEnergyConsumption
      : capabilities.hasEstimatedEnergyProduction ||
          capabilities.hasMeasuredEnergyProduction
  }
}
