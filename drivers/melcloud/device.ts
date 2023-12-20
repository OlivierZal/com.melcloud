import BaseMELCloudDevice from '../../bases/device'
import type AtaDriver from './driver'
import {
  HorizontalAta,
  OperationModeAta,
  VerticalAta,
  type Capability,
  type CapabilityValue,
  type DeviceValue,
  type SetCapability,
  type SetDeviceValue,
} from '../../types'

const isThermostatMode = (value: string): boolean =>
  !['dry', 'fan'].includes(value)

export = class AtaDevice extends BaseMELCloudDevice {
  protected reportPlanParameters: {
    duration: object
    interval: object
    minus: object
    values: object
  } = {
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
      this.diff.set('onoff', value !== 'off')
      if (value !== 'off') {
        this.diff.set('operation_mode', value)
      }
      await this.setAlwaysOnWarning()
    } else {
      this.diff.set(capability, value)
      if (
        capability === 'operation_mode' &&
        !isThermostatMode(value as string) &&
        this.getCapabilityValue('thermostat_mode') !== 'off'
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
        return (this.getSetting('always_on') as boolean)
          ? true
          : (value as boolean)
      case 'operation_mode':
        return OperationModeAta[value as keyof typeof OperationModeAta]
      case 'vertical':
        return VerticalAta[value as keyof typeof VerticalAta]
      case 'horizontal':
        return HorizontalAta[value as keyof typeof HorizontalAta]
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
        return OperationModeAta[value as number]
      case 'vertical':
        return VerticalAta[value as number]
      case 'horizontal':
        return HorizontalAta[value as number]
      default:
        return value
    }
  }

  protected async updateThermostatMode(success: boolean): Promise<void> {
    if (!success) {
      return
    }
    const isOn: boolean = this.getCapabilityValue('onoff') as boolean
    const operationMode: string = this.getCapabilityValue(
      'operation_mode',
    ) as string
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn && isThermostatMode(operationMode) ? operationMode : 'off',
    )
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected async updateStore(): Promise<void> {
    // Not implemented.
  }
}
