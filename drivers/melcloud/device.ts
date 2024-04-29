import {
  type Capabilities,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilities,
  type ReportPlanParameters,
  type SetCapabilities,
  ThermostatMode,
} from '../../types'
import {
  type DeviceData,
  FanSpeed,
  Horizontal,
  type ListDevice,
  OperationMode,
  Vertical,
} from 'melcloud-api'
import BaseMELCloudDevice from '../../bases/device'

export = class AtaDevice extends BaseMELCloudDevice<'Ata'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilities['Ata'], ConvertFromDevice<'Ata'>>
  > = {
    'alarm_generic.silent': ((value: FanSpeed) =>
      value === FanSpeed.silent) as ConvertFromDevice<'Ata'>,
    fan_power: ((value: FanSpeed) =>
      value === FanSpeed.silent ?
        FanSpeed.auto
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
    operation_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<'Ata'>,
    target_temperature: ((value: number) =>
      this.#getTargetTemperature(value)) as ConvertToDevice<'Ata'>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<'Ata'>,
  }

  public override getCapabilityValue<K extends keyof Capabilities['Ata']>(
    capability: K & string,
  ): NonNullable<Capabilities['Ata'][K]> {
    if (
      capability === 'fan_power' &&
      this.getCapabilityValue('alarm_generic.silent')
    ) {
      return FanSpeed.silent as NonNullable<Capabilities['Ata'][K]>
    }
    return super.getCapabilityValue(capability)
  }

  protected override registerCapabilityListeners(): void {
    super.registerCapabilityListeners()
    this.#registerThermostatModeListener()
  }

  protected override async setCapabilities(
    data: DeviceData['Ata'] | ListDevice['Ata']['Device'] | null,
  ): Promise<void> {
    await super.setCapabilities(data)
    if (data) {
      await this.#setThermostatMode()
    }
  }

  readonly #getTargetTemperature = (value: number): number => {
    const operationMode =
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

  #registerThermostatModeListener(): void {
    this.registerCapabilityListener(
      'thermostat_mode',
      (value: ThermostatMode) => {
        this.clearSyncToDevice()
        this.setDiff('onoff', value !== ThermostatMode.off)
        if (value !== ThermostatMode.off) {
          this.setDiff('operation_mode', value)
        }
        this.applySyncToDevice()
      },
    )
  }

  async #setThermostatMode(): Promise<void> {
    const isOn = this.getCapabilityValue('onoff')
    const operationMode = this.getCapabilityValue('operation_mode')
    await this.setCapabilityValue(
      'thermostat_mode',
      isOn && operationMode in ThermostatMode ?
        (operationMode as ThermostatMode)
      : ThermostatMode.off,
    )
  }
}
