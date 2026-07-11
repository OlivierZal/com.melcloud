import type * as Classic from '@olivierzal/melcloud-api/classic'
import type * as Home from '@olivierzal/melcloud-api/home'

import { HotWaterMode } from '../../types/atw.mts'
import {
  type HomeCapabilitiesAtw,
  type HomeConvertFromDevice,
  type HomeConvertToDevice,
  type HomeSetCapabilitiesAtw,
  operationModeZoneToHome,
  toThermostatModeAtw,
} from '../../types/home-atw.mts'
import { BaseMELCloudDevice } from '../base-device.mts'
import type HomeMELCloudDriverAtw from './driver.mts'

export default class HomeMELCloudDeviceAtw extends BaseMELCloudDevice<Home.DeviceAtwFacade> {
  declare public readonly driver: HomeMELCloudDriverAtw

  declare public readonly getData: () => { id: string }

  public override get id(): string {
    return this.getData().id
  }

  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAtw, HomeConvertToDevice>
  > = {
    hot_water_mode: (value: keyof typeof HotWaterMode) =>
      HotWaterMode[value] === HotWaterMode.forced,
    thermostat_mode: (value: keyof typeof Classic.OperationModeZone) =>
      operationModeZoneToHome[value],
    'thermostat_mode.zone2': (value: keyof typeof Classic.OperationModeZone) =>
      operationModeZoneToHome[value],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAtw,
    HomeConvertFromDevice
  > = {
    hot_water_mode: ({ forcedHotWaterMode: isForced }) =>
      isForced ? HotWaterMode.forced : HotWaterMode.auto,
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperatureZone1 }) => roomTemperatureZone1,
    'measure_temperature.outdoor': ({ outdoorTemperature }) =>
      outdoorTemperature,
    'measure_temperature.tank_water': ({ tankWaterTemperature }) =>
      tankWaterTemperature,
    'measure_temperature.zone2': ({ roomTemperatureZone2 }) =>
      roomTemperatureZone2,
    onoff: ({ power: isOn }) => isOn,
    target_temperature: ({ setTemperatureZone1 }) => setTemperatureZone1,
    'target_temperature.tank_water': ({ setTankWaterTemperature }) =>
      setTankWaterTemperature,
    'target_temperature.zone2': ({ setTemperatureZone2 }) =>
      setTemperatureZone2,
    thermostat_mode: ({ operationModeZone1 }) =>
      toThermostatModeAtw(operationModeZone1),
    'thermostat_mode.zone2': ({ operationModeZone2 }) =>
      toThermostatModeAtw(operationModeZone2),
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode = null

  public override async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (device === null) {
      return
    }
    await this.#setCapabilityValues(device)
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    /* v8 ignore next -- cachedFacade is always set before init() calls applyCapabilitiesOptions */
    if (this.cachedFacade === undefined) {
      return
    }
    await super.applyCapabilitiesOptions(this.cachedFacade)
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- required override of abstract method; Home devices do not support energy reports
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  protected override getFacade(): Home.DeviceAtwFacade {
    return this.homey.app.getHomeFacade(this.id, this.driver.type)
  }

  protected override getRequiredCapabilities(): string[] {
    /* v8 ignore next -- defensive guard: facade is set after init */
    return this.cachedFacade === undefined ?
        []
      : this.driver.getRequiredCapabilities(this.cachedFacade)
  }

  async #setCapabilityValues(device: Home.DeviceAtwFacade): Promise<void> {
    await Promise.all(
      Object.entries(this.deviceToCapability).map(
        async ([capability, convert]) => {
          if (this.hasCapability(capability)) {
            await this.setCapabilityValue(capability, convert(device))
          }
        },
      ),
    )
  }
}
