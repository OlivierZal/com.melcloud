import {
  type FanSpeed,
  type HomeDeviceAtaFacade,
  fanSpeedFromClassic,
  fanSpeedToClassic,
  Horizontal,
  horizontalFromClassic,
  horizontalToClassic,
  OperationMode,
  operationModeFromClassic,
  operationModeToClassic,
  Vertical,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'

import {
  type DeviceFacade,
  type HomeCapabilitiesAta,
  type HomeConvertFromDevice,
  type HomeConvertToDevice,
  type HomeSetCapabilitiesAta,
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

export default class HomeMELCloudDeviceAta extends BaseMELCloudDevice {
  declare public readonly getData: () => { id: string }

  public override get id(): string {
    return this.getData().id
  }

  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {
    fan_speed: (value: FanSpeed) => fanSpeedFromClassic[value],
    horizontal: (value: keyof typeof Horizontal) =>
      horizontalFromClassic[Horizontal[value]],
    thermostat_mode: (value: keyof typeof OperationMode) =>
      operationModeFromClassic[OperationMode[value]],
    vertical: (value: keyof typeof Vertical) =>
      verticalFromClassic[Vertical[value]],
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
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    /* v8 ignore next -- cachedFacade is always set before init() calls applyCapabilitiesOptions */
    if (this.cachedFacade && 'capabilities' in this.cachedFacade) {
      await super.applyCapabilitiesOptions(this.cachedFacade.capabilities)
    }
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- required override of abstract method; Home devices do not support energy reports
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  /* v8 ignore next -- tested via TestHomeDevice which provides its own implementation */
  protected override getFacade(): HomeDeviceAtaFacade {
    return this.homey.app.getHomeFacade(this.id)
  }

  async #setCapabilityValues(device: DeviceFacade): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converters accept DeviceFacade at runtime; concrete HomeConvertFromDevice type is narrower for bivariance
    const converters = Object.entries(this.deviceToCapability) as [
      string,
      (device: DeviceFacade) => unknown,
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
