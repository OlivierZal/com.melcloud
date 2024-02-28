import {
  type Capabilities,
  type CapabilitiesOptions,
  type FlowArgsAtw,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type OpCapabilities,
  type ReportCapabilityTagMapping,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Store,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  reportCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from '../../types'
import {
  DeviceType,
  type ListDevice,
  effectiveFlagsAtw,
} from '../../melcloud/types'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtwDriver extends BaseMELCloudDriver<'Atw'> {
  public readonly effectiveFlags: typeof effectiveFlagsAtw = effectiveFlagsAtw

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping['Atw'] =
    getCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping['Atw'] =
    listCapabilityTagMappingAtw

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMapping['Atw'] =
    reportCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping['Atw'] =
    setCapabilityTagMappingAtw

  protected readonly deviceType: DeviceType = DeviceType.Atw

  readonly #capabilities: (keyof OpCapabilities['Atw'])[] = [
    'onoff',
    'onoff.forced_hot_water',
    'measure_temperature',
    'measure_temperature.outdoor',
    'measure_temperature.flow',
    'measure_temperature.return',
    'measure_temperature.tank_water',
    'target_temperature',
    'target_temperature.tank_water',
    'target_temperature.flow_heat',
    'operation_mode_state',
    'measure_power.heat_pump_frequency',
    'measure_power',
    'measure_power.produced',
  ]

  readonly #coolCapabilities: (keyof OpCapabilities['Atw'])[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  readonly #coolZone2Capabilities: (keyof OpCapabilities['Atw'])[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  readonly #flowCapabilities: (keyof Capabilities<'Atw'>)[] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as (keyof Capabilities<'Atw'>)[]

  readonly #notCoolCapabilities: (keyof OpCapabilities['Atw'])[] = [
    'operation_mode_zone',
  ]

  readonly #notCoolZone2Capabilities: (keyof OpCapabilities['Atw'])[] = [
    'operation_mode_zone.zone2',
  ]

  readonly #zone2Capabilities: (keyof OpCapabilities['Atw'])[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  public getCapabilities({ canCool, hasZone2 }: Store['Atw']): string[] {
    return [
      ...this.#capabilities,
      ...(canCool ? this.#coolCapabilities : this.#notCoolCapabilities),
      ...(hasZone2
        ? [
            ...this.#zone2Capabilities,
            ...(canCool
              ? this.#coolZone2Capabilities
              : this.#notCoolZone2Capabilities),
          ]
        : []),
    ]
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected getCapabilitiesOptions(): Partial<CapabilitiesOptions['Atw']> {
    return {}
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected getStore({
    CanCool: canCool,
    HasZone2: hasZone2,
    MaxTankTemperature: maxTankTemperature,
  }: ListDevice['Atw']['Device']): Store['Atw'] {
    return { canCool, hasZone2, maxTankTemperature }
  }

  protected registerRunListeners(): void {
    this.#flowCapabilities.forEach((capability: keyof Capabilities<'Atw'>) => {
      switch (true) {
        case capability.startsWith('alarm_generic'):
        case capability.startsWith('onoff.'):
          this.#registerBooleanRunListener(capability)
          break
        case capability.startsWith('operation_mode'):
          this.#registerOperationModeRunListener(capability)
          break
        case capability.startsWith('target_temperature.'):
          this.#registerTargetTemperatureRunListener(capability)
          break
        default:
      }
    })
  }

  #registerBooleanRunListener(capability: keyof Capabilities<'Atw'>): void {
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgsAtw): boolean =>
          args.device.getCapabilityValue(capability) as boolean,
      )
    if (capability.startsWith('onoff.')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAtw): Promise<void> => {
          await args.device.onCapability(
            capability as keyof SetCapabilities['Atw'],
            args.onoff,
          )
        })
    }
  }

  #registerOperationModeRunListener(
    capability: keyof Capabilities<'Atw'>,
  ): void {
    const capabilityArg: 'operation_mode_state' | 'operation_mode_zone' =
      capability.startsWith('operation_mode_state')
        ? 'operation_mode_state'
        : 'operation_mode_zone'
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgsAtw): boolean =>
          args[capabilityArg] === args.device.getCapabilityValue(capability),
      )
    if (capability.startsWith('operation_mode_zone')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgsAtw): Promise<void> => {
          await args.device.onCapability(
            capability as keyof SetCapabilities['Atw'],
            args.operation_mode_zone,
          )
        })
    }
  }

  #registerTargetTemperatureRunListener(
    capability: keyof Capabilities<'Atw'>,
  ): void {
    this.homey.flow
      .getActionCard(`${capability}_action`)
      .registerRunListener(async (args: FlowArgsAtw): Promise<void> => {
        await args.device.onCapability(
          capability as keyof SetCapabilities['Atw'],
          args.target_temperature,
        )
      })
  }
}
