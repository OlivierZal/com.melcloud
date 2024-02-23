import {
  type DeviceDataAta,
  type DeviceDataFromListAta,
  Horizontal,
  OperationMode,
  type SetDeviceDataAta,
  Vertical,
} from '../../types/MELCloudAPITypes'
import {
  type NonEffectiveFlagsValueOf,
  type OpCapabilitiesAta,
  type ReportPlanParameters,
  type SetCapabilitiesAta,
  type SetCapabilitiesWithThermostatModeAta,
  ThermostatMode,
} from '../../types/types'
import type AtaDriver from './driver'
import BaseMELCloudDevice from '../../bases/device'
import { NUMBER_0 } from '../../constants'

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
  protected convertFromDevice<K extends keyof OpCapabilitiesAta>(
    capability: K,
    value:
      | NonEffectiveFlagsValueOf<DeviceDataAta>
      | NonEffectiveFlagsValueOf<DeviceDataFromListAta>,
  ): OpCapabilitiesAta[K] {
    switch (capability) {
      case 'operation_mode':
        return OperationMode[value as OperationMode] as OpCapabilitiesAta[K]
      case 'vertical':
        return Vertical[value as Vertical] as OpCapabilitiesAta[K]
      case 'horizontal':
        return Horizontal[value as Horizontal] as OpCapabilitiesAta[K]
      case 'fan_power':
        return (value === NUMBER_255 ? NUMBER_0 : value) as OpCapabilitiesAta[K]
      default:
        return value as OpCapabilitiesAta[K]
    }
  }

  protected convertToDevice<K extends keyof SetCapabilitiesAta>(
    capability: K,
    value: SetCapabilitiesAta[K],
  ): NonEffectiveFlagsValueOf<SetDeviceDataAta> {
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
        return value as NonEffectiveFlagsValueOf<SetDeviceDataAta>
    }
  }

  protected async specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatModeAta,
  >(
    capability: K,
    value: SetCapabilitiesWithThermostatModeAta[K],
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
