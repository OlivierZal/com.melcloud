import {
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilities,
  type ReportPlanParameters,
  type SetCapabilities,
  type SetCapabilitiesWithThermostatMode,
  ThermostatMode,
} from '../../types'
import {
  FanSpeed,
  Horizontal,
  OperationMode,
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

  protected readonly toDevice: Partial<
    Record<keyof SetCapabilities['Ata'], ConvertToDevice<'Ata'>>
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<'Ata'>,
    onoff: ((value: boolean) =>
      this.getSetting('always_on') || value) as ConvertToDevice<'Ata'>,
    operation_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<'Ata'>,
    target_temperature: ((value: number) =>
      this.#getTargetTemperature(value)) as ConvertToDevice<'Ata'>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<'Ata'>,
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
