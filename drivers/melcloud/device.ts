import {
  type ConvertFromDevice,
  type OpCapabilities,
  type ReportPlanParameters,
  type SetCapabilities,
  type SetCapabilitiesWithThermostatMode,
  ThermostatMode,
} from '../../types'
import {
  FanSpeed,
  Horizontal,
  type NonEffectiveFlagsValueOf,
  OperationMode,
  type SetDeviceData,
  Vertical,
} from '../../melcloud/types'
import BaseMELCloudDevice from '../../bases/device'

const isThermostatMode = (
  value: keyof typeof OperationMode,
): value is ThermostatMode & keyof typeof OperationMode =>
  value in ThermostatMode

export = class AtaDevice extends BaseMELCloudDevice<'Ata'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilities['Ata'], ConvertFromDevice<'Ata'>>
  > = {
    fan_power: ((value: FanSpeed) =>
      value === FanSpeed.silent
        ? FanSpeed.auto
        : value) as ConvertFromDevice<'Ata'>,
    horizontal: ((value: Horizontal) =>
      Horizontal[value]) as ConvertFromDevice<'Ata'>,
    operation_mode: ((value: OperationMode) =>
      OperationMode[value]) as ConvertFromDevice<'Ata'>,
    vertical: ((value: Vertical) =>
      Vertical[value]) as ConvertFromDevice<'Ata'>,
  }

  protected readonly reportPlanParameters: ReportPlanParameters = {
    duration: { hours: 1 },
    interval: { hours: 1 },
    minus: { hours: 1 },
    values: { millisecond: 0, minute: 5, second: 0 },
  }

  protected convertToDevice<K extends keyof SetCapabilities['Ata']>(
    capability: K,
    value: SetCapabilities['Ata'][K],
  ): NonEffectiveFlagsValueOf<SetDeviceData['Ata']> {
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') || (value as boolean)
      case 'operation_mode':
        return OperationMode[value as keyof typeof OperationMode]
      case 'vertical':
        return Vertical[value as keyof typeof Vertical]
      case 'horizontal':
        return Horizontal[value as keyof typeof Horizontal]
      case 'target_temperature':
        return this.#getTargetTemperature(value as number)
      default:
        return value as NonEffectiveFlagsValueOf<SetDeviceData['Ata']>
    }
  }

  protected async specificOnCapability<
    K extends keyof SetCapabilitiesWithThermostatMode['Ata'],
  >(
    capability: K,
    value: SetCapabilitiesWithThermostatMode['Ata'][K],
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

  readonly #getTargetTemperature = (value: number): number => {
    const operationMode: OperationMode =
      OperationMode[this.getRequestedOrCurrentValue('operation_mode')]
    switch (operationMode) {
      case OperationMode.auto:
        return Math.max(value, this.getStoreValue('minTempAutomatic'))
      case OperationMode.cool:
      case OperationMode.dry:
        return Math.max(value, this.getStoreValue('minTempCoolDry'))
      case OperationMode.heat:
        return Math.max(value, this.getStoreValue('minTempHeat'))
      default:
        return value
    }
  }
}
