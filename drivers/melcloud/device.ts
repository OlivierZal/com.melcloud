import BaseMELCloudDevice from '../../bases/device'
import type AtaDriver from './driver'
import {
  Horizontal,
  OperationMode,
  ThermostatMode,
  Vertical,
  type Capability,
  type CapabilityValue,
  type DeviceValue,
  type ReportPlanParameters,
  type SetCapability,
  type SetDeviceValue,
} from '../../types'

const isThermostatMode = (value: keyof typeof OperationMode): boolean =>
  value in ThermostatMode

export = class AtaDevice extends BaseMELCloudDevice {
  protected readonly reportPlanParameters: ReportPlanParameters = {
    minus: { hours: 1 },
    interval: { hours: 1 },
    duration: { hours: 1 },
    values: { minute: 5, second: 0, millisecond: 0 },
  }

  protected async specificOnCapability(
    capability: SetCapability<AtaDriver> | 'thermostat_mode',
    value: CapabilityValue,
  ): Promise<void> {
    if (capability === 'thermostat_mode') {
      const isOn: boolean =
        ThermostatMode[value as keyof typeof ThermostatMode] !==
        ThermostatMode.off
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
        ThermostatMode[
          this.getCapabilityValue(
            'thermostat_mode',
          ) as keyof typeof ThermostatMode
        ] !== ThermostatMode.off
      ) {
        await this.setDisplayErrorWarning()
      }
    }
  }

  protected convertToDevice(
    capability: SetCapability<AtaDriver>,
    value: CapabilityValue,
  ): SetDeviceValue {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') === true || (value as boolean)
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
  protected convertFromDevice(
    capability: Capability<AtaDriver> | 'thermostat_mode',
    value: DeviceValue,
  ): CapabilityValue {
    switch (capability) {
      case 'operation_mode':
        return OperationMode[value as number]
      case 'vertical':
        return Vertical[value as number]
      case 'horizontal':
        return Horizontal[value as number]
      default:
        return value
    }
  }

  protected async updateThermostatMode(success: boolean): Promise<void> {
    if (!success) {
      return
    }
    const isOn: boolean = this.getCapabilityValue('onoff') as boolean
    const operationMode: keyof typeof OperationMode = this.getCapabilityValue(
      'operation_mode',
    ) as keyof typeof OperationMode
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn && isThermostatMode(operationMode)
        ? operationMode
        : ThermostatMode[ThermostatMode.off],
    )
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateStore(): Promise<void> {
    // Not implemented.
  }
}
