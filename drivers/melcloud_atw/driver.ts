import {
  type Capabilities,
  type FlowArgs,
  type GetCapabilityTagMapping,
  type ListCapabilityTagMapping,
  type OpCapabilities,
  type ReportCapabilityTagMapping,
  type SetCapabilities,
  type SetCapabilityTagMapping,
  type Store,
  type StoreMapping,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  reportCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
  storeMappingAtw,
} from '../../types'
import { DeviceType, effectiveFlagsAtw } from '../../melcloud/types'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtwDriver extends BaseMELCloudDriver<'Atw'> {
  public readonly effectiveFlags: typeof effectiveFlagsAtw = effectiveFlagsAtw

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping['Atw'] =
    getCapabilityTagMappingAtw

  public readonly lastCapabilitiesToUpdate: (keyof OpCapabilities['Atw'])[] = [
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping['Atw'] =
    listCapabilityTagMappingAtw

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMapping['Atw'] =
    reportCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping['Atw'] =
    setCapabilityTagMappingAtw

  protected readonly deviceType: DeviceType = DeviceType.Atw

  protected readonly storeMapping: StoreMapping['Atw'] = storeMappingAtw

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
    (this.manifest.capabilities as (keyof Capabilities<'Atw'>)[]).filter(
      (capability: keyof Capabilities<'Atw'>) =>
        capability.startsWith('alarm_generic') ||
        capability.startsWith('onoff.') ||
        capability.startsWith('operation_mode') ||
        capability.startsWith('target_temperature.'),
    )

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

  protected registerRunListeners(): void {
    this.#flowCapabilities.forEach((capability: keyof Capabilities<'Atw'>) => {
      switch (true) {
        case capability.startsWith('alarm_generic'):
        case capability.startsWith('onoff.'):
          this.#registerBooleanRunListeners(capability)
          break
        case capability.startsWith('operation_mode'):
          this.#registerOperationModeRunListeners(capability)
          break
        case capability.startsWith('target_temperature.'):
          this.#registerTargetTemperatureRunListener(capability)
          break
        default:
      }
    })
  }

  #registerBooleanRunListeners(capability: keyof Capabilities<'Atw'>): void {
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgs['Atw']): boolean =>
          args.device.getCapabilityValue(capability) as boolean,
      )
    if (capability.startsWith('onoff.')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs['Atw']): Promise<void> => {
          await args.device.triggerCapabilityListener(
            capability as keyof SetCapabilities['Atw'],
            args.onoff,
          )
        })
    }
  }

  #registerOperationModeRunListeners(
    capability: keyof Capabilities<'Atw'>,
  ): void {
    const capabilityArg: 'operation_mode_state' | 'operation_mode_zone' =
      capability.startsWith('operation_mode_state')
        ? 'operation_mode_state'
        : 'operation_mode_zone'
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgs['Atw']): boolean =>
          args[capabilityArg] === args.device.getCapabilityValue(capability),
      )
    if (capability.startsWith('operation_mode_zone')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs['Atw']): Promise<void> => {
          await args.device.triggerCapabilityListener(
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
      .registerRunListener(async (args: FlowArgs['Atw']): Promise<void> => {
        await args.device.triggerCapabilityListener(
          capability as keyof SetCapabilities['Atw'],
          args.target_temperature,
        )
      })
  }
}
