import {
  type DeviceData,
  Horizontal,
  OperationMode,
  Vertical,
} from '../../types/MELCloudAPITypes'
import {
  type DeviceDataFromList,
  type NonEffectiveFlagsValueOf,
  type OpCapabilities,
  type ReportPlanParameters,
  type SetCapabilities,
  type SetCapabilitiesWithThermostatMode,
  type SetDeviceData,
  ThermostatMode,
} from '../../types/types'
import type AtaDriver from './driver'
import BaseMELCloudDevice from '../../bases/device'

const NUMBER_5 = 5
const NUMBER_255 = 255

const isThermostatMode = (
  value: keyof typeof OperationMode,
): value is ThermostatMode & keyof typeof OperationMode =>
  value in ThermostatMode

export = class AtaDevice extends BaseMELCloudDevice<AtaDriver> {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof OpCapabilities<AtaDriver>>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceData<AtaDriver['heatPumpType']>>
      | NonEffectiveFlagsValueOf<DeviceDataFromList<AtaDriver>>,
  ): OpCapabilities<AtaDriver>[K] {
    switch (capability) {
      case 'operation_mode':
        return OperationMode[
          value as OperationMode
        ] as OpCapabilities<AtaDriver>[K]
      case 'vertical':
        return Vertical[value as Vertical] as OpCapabilities<AtaDriver>[K]
      case 'horizontal':
        return Horizontal[value as Horizontal] as OpCapabilities<AtaDriver>[K]
      case 'fan_power':
        return (
          value === NUMBER_255 ? NUMBER_5 : value
        ) as OpCapabilities<AtaDriver>[K]
      default:
        return value as OpCapabilities<AtaDriver>[K]
    }
  }

  protected convertToDevice<K extends keyof SetCapabilities<AtaDriver>>(
    capability: K,
    value: SetCapabilities<AtaDriver>[K],
  ): NonEffectiveFlagsValueOf<SetDeviceData<AtaDriver>> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'operation_mode':
        return OperationMode[value as keyof typeof OperationMode]
      case 'vertical':
        return Vertical[value as keyof typeof Vertical]
      case 'horizontal':
        return Horizontal[value as keyof typeof Horizontal]
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceData<AtaDriver>>
    }
  }

  protected async specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatMode<AtaDriver>,
  >(
    capability: K,
    value: SetCapabilitiesWithThermostatMode<AtaDriver>[K],
  ): Promise<void> {
    if (capability === 'thermostat_mode') {
      const isOn: boolean = value !== ThermostatMode.off
      this.diff.set('onoff', isOn)
      if (isOn) {
        this.diff.set(
          'operation_mode',
          value as Exclude<ThermostatMode, ThermostatMode.off>,
        )
      }
      await this.setAlwaysOnWarning()
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateStore(): Promise<void> {
    // Not implemented
  }

  protected async updateThermostatMode(): Promise<void> {
    const isOn: boolean = this.getCapabilityValue('onoff')
    const operationMode: keyof typeof OperationMode =
      this.getCapabilityValue('operation_mode')
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn && isThermostatMode(operationMode)
        ? operationMode
        : ThermostatMode.off,
    )
  }
}
