import BaseMELCloudDevice from '../../bases/device'
import type AtaDriver from './driver'
import type {
  Capability,
  CapabilityValue,
  DeviceValue,
  ReportPlanParameters,
  SetCapability,
  SetDeviceValue,
} from '../../types'

enum OperationMode {
  heat = 1,
  dry = 2,
  cool = 3,
  fan = 7,
  auto = 8,
}

enum Vertical {
  auto = 0,
  top = 1,
  middletop = 2,
  middle = 3,
  middlebottom = 4,
  bottom = 5,
  swing = 7,
}

enum Horizontal {
  auto = 0,
  left = 1,
  middleleft = 2,
  middle = 3,
  middleright = 4,
  right = 5,
  swing = 12,
}

const isThermostatMode = (value: string): boolean =>
  !['dry', 'fan'].includes(value)

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
