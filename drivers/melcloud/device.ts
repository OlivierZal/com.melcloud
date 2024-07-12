import {
  type CapabilitiesAta,
  type ConvertFromDevice,
  type ConvertToDevice,
  type OpCapabilitiesAta,
  type ReportPlanParameters,
  type SetCapabilitiesAta,
  ThermostatMode,
} from '../../types'
import {
  FanSpeed,
  Horizontal,
  OperationMode,
  Vertical,
} from '@olivierzal/melcloud-api'
import BaseMELCloudDevice from '../../bases/device'

export = class extends BaseMELCloudDevice<'Ata'> {
  protected readonly fromDevice: Partial<
    Record<keyof OpCapabilitiesAta, ConvertFromDevice<'Ata'>>
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
    Record<keyof SetCapabilitiesAta, ConvertToDevice<'Ata'>>
  > = {
    horizontal: ((value: keyof typeof Horizontal) =>
      Horizontal[value]) as ConvertToDevice<'Ata'>,
    operation_mode: ((value: keyof typeof OperationMode) =>
      OperationMode[value]) as ConvertToDevice<'Ata'>,
    vertical: ((value: keyof typeof Vertical) =>
      Vertical[value]) as ConvertToDevice<'Ata'>,
  }

  public override getCapabilityValue<K extends keyof CapabilitiesAta>(
    capability: K & string,
  ): NonNullable<CapabilitiesAta[K]> {
    if (
      capability === 'fan_power' &&
      this.getCapabilityValue('alarm_generic.silent')
    ) {
      return FanSpeed.silent as NonNullable<CapabilitiesAta[K]>
    }
    return super.getCapabilityValue(capability)
  }

  protected override registerCapabilityListeners(): void {
    super.registerCapabilityListeners()
    this.#registerThermostatModeListener()
  }

  protected override async setCapabilities(): Promise<void> {
    await super.setCapabilities()
    await this.#setThermostatMode()
  }

  #registerThermostatModeListener(): void {
    this.registerCapabilityListener(
      'thermostat_mode',
      (value: ThermostatMode) => {
        this.clearSyncToDevice()
        this.diff.set('onoff', value !== ThermostatMode.off)
        if (value !== ThermostatMode.off) {
          this.diff.set('operation_mode', value)
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
