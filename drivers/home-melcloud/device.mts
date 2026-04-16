import type * as Home from '@olivierzal/melcloud-api/home'
import {
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { ClassicDeviceFacade } from '../../types/device.mts'
import type {
  HomeCapabilitiesAta,
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeSetCapabilitiesAta,
} from '../../types/home-ata.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class HomeMELCloudDeviceAta extends BaseMELCloudDevice {
  declare public readonly getData: () => { id: string }

  public override get id(): string {
    return this.getData().id
  }

  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {
    fan_speed: (value: Classic.FanSpeed) => fanSpeedFromClassic[value],
    horizontal: (value: keyof typeof Classic.Horizontal) =>
      horizontalFromClassic[Classic.Horizontal[value]],
    thermostat_mode: (value: keyof typeof Classic.OperationMode) =>
      operationModeFromClassic[Classic.OperationMode[value]],
    vertical: (value: keyof typeof Classic.Vertical) =>
      verticalFromClassic[Classic.Vertical[value]],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAta,
    HomeConvertFromDevice
  > = {
    fan_speed: ({ setFanSpeed }) => fanSpeedToClassic[setFanSpeed],
    horizontal: ({ vaneHorizontalDirection }) =>
      horizontalFromDevice[horizontalToClassic[vaneHorizontalDirection]],
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power }) => power,
    target_temperature: ({ setTemperature }) => setTemperature,
    thermostat_mode: ({ operationMode, power }) =>
      power ?
        operationModeFromDevice[operationModeToClassic[operationMode]]
      : ThermostatModeAta.off,
    vertical: ({ vaneVerticalDirection }) =>
      verticalFromDevice[verticalToClassic[vaneVerticalDirection]],
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode = ThermostatModeAta

  public override async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (!device) {
      return
    }
    await this.#setCapabilityValues(device)
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    /* v8 ignore next -- cachedFacade is always set before init() calls applyCapabilitiesOptions */
    if (!this.cachedFacade || !('capabilities' in this.cachedFacade)) {
      return
    }
    await super.applyCapabilitiesOptions(this.cachedFacade.capabilities)
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- required override of abstract method; Home devices do not support energy reports
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  /* v8 ignore next -- tested via TestHomeDevice which provides its own implementation */
  protected override getFacade(): Home.DeviceAtaFacade {
    return this.homey.app.getHomeFacade(this.id)
  }

  async #setCapabilityValues(device: ClassicDeviceFacade): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converters accept ClassicDeviceFacade at runtime; concrete HomeConvertFromDevice type is narrower for bivariance
    const converters = Object.entries(this.deviceToCapability) as [
      string,
      (device: ClassicDeviceFacade) => unknown,
    ][]
    await Promise.all(
      converters.map(async ([capability, convert]) => {
        /* v8 ignore next -- hasCapability always true in tests */
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, convert(device))
        }
      }),
    )
  }
}
