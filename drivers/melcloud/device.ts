import BaseMELCloudDevice from '../../bases/device'
import type AtaDriver from './driver'
import {
  Horizontal,
  OperationMode,
  ThermostatMode,
  Vertical,
  type SetCapabilities,
  type CapabilityValue,
  type DeviceValue,
  type ReportPlanParameters,
  type SetCapabilityWithThermostatMode,
  type SetDeviceValue,
  type Capabilities,
} from '../../types'

const isThermostatMode = (
  value: keyof typeof OperationMode,
): value is ThermostatMode & keyof typeof OperationMode =>
  value in ThermostatMode

export = class AtaDevice extends BaseMELCloudDevice<AtaDriver> {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    minus: { hours: 1 },
    interval: { hours: 1 },
    duration: { hours: 1 },
    values: { minute: 5, second: 0, millisecond: 0 },
  }

  protected async specificOnCapability(
    capability: SetCapabilityWithThermostatMode<AtaDriver>,
    value: CapabilityValue,
  ): Promise<void> {
    if (capability === 'thermostat_mode') {
      const isOn: boolean = value !== ThermostatMode.off
      this.diff.set('onoff', isOn)
      if (isOn) {
        this.diff.set('operation_mode', value)
      }
      await this.setAlwaysOnWarning()
    } else {
      this.diff.set(capability, value)
      if (
        capability === 'operation_mode' &&
        !isThermostatMode(value as keyof typeof OperationMode) &&
        this.getCapabilityValue('thermostat_mode') !== ThermostatMode.off
      ) {
        await this.setDisplayErrorWarning()
      }
    }
  }

  protected convertToDevice<K extends keyof SetCapabilities<AtaDriver>>(
    capability: K,
    value: SetCapabilities<AtaDriver>[K],
  ): SetDeviceValue {
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
        return value as SetDeviceValue
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected convertFromDevice<K extends keyof Capabilities<AtaDriver>>(
    capability: K,
    value: DeviceValue,
  ): Capabilities<AtaDriver>[K] {
    switch (capability) {
      case 'operation_mode':
        return OperationMode[
          value as OperationMode
        ] as Capabilities<AtaDriver>[K]
      case 'vertical':
        return Vertical[value as Vertical] as Capabilities<AtaDriver>[K]
      case 'horizontal':
        return Horizontal[value as Horizontal] as Capabilities<AtaDriver>[K]
      default:
        return value as Capabilities<AtaDriver>[K]
    }
  }

  protected async updateThermostatMode(success: boolean): Promise<void> {
    if (!success) {
      return
    }
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateStore(): Promise<void> {
    // Not implemented.
  }
}
