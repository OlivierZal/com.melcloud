import {
  type CapabilitiesAtw,
  type FlowArgsAtw,
  type GetCapabilityTagMappingAtw,
  type ListCapabilityTagMappingAtw,
  type OpCapabilitiesAtw,
  type ReportCapabilityTagMappingAtw,
  type SetCapabilitiesAtw,
  type SetCapabilityTagMappingAtw,
  type Store,
  getCapabilityTagMappingAtw,
  listCapabilityTagMappingAtw,
  reportCapabilityTagMappingAtw,
  setCapabilityTagMappingAtw,
} from '../../types/types'
import { HeatPumpType, effectiveFlagsAtw } from '../../types/MELCloudAPITypes'
import BaseMELCloudDriver from '../../bases/driver'

export = class AtwDriver extends BaseMELCloudDriver<'Atw'> {
  public readonly effectiveFlags: typeof effectiveFlagsAtw = effectiveFlagsAtw

  public readonly getCapabilityTagMapping: GetCapabilityTagMappingAtw =
    getCapabilityTagMappingAtw

  public readonly listCapabilityTagMapping: ListCapabilityTagMappingAtw =
    listCapabilityTagMappingAtw

  public readonly reportCapabilityTagMapping: ReportCapabilityTagMappingAtw =
    reportCapabilityTagMappingAtw

  public readonly setCapabilityTagMapping: SetCapabilityTagMappingAtw =
    setCapabilityTagMappingAtw

  protected readonly deviceType: HeatPumpType = HeatPumpType.Atw

  readonly #capabilities: (keyof OpCapabilitiesAtw)[] = [
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

  readonly #coolCapabilities: (keyof OpCapabilitiesAtw)[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  readonly #coolZone2Capabilities: (keyof OpCapabilitiesAtw)[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  readonly #flowCapabilities: (keyof CapabilitiesAtw)[] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as (keyof CapabilitiesAtw)[]

  readonly #notCoolCapabilities: (keyof OpCapabilitiesAtw)[] = [
    'operation_mode_zone',
  ]

  readonly #notCoolZone2Capabilities: (keyof OpCapabilitiesAtw)[] = [
    'operation_mode_zone.zone2',
  ]

  readonly #zone2Capabilities: (keyof OpCapabilitiesAtw)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  public getRequiredCapabilities({ canCool, hasZone2 }: Store): string[] {
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
    this.#flowCapabilities.forEach((capability: keyof CapabilitiesAtw) => {
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

  #registerBooleanRunListener(capability: keyof CapabilitiesAtw): void {
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
            capability as keyof SetCapabilitiesAtw,
            args.onoff,
          )
        })
    }
  }

  #registerOperationModeRunListener(capability: keyof CapabilitiesAtw): void {
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
            capability as keyof SetCapabilitiesAtw,
            args.operation_mode_zone,
          )
        })
    }
  }

  #registerTargetTemperatureRunListener(
    capability: keyof CapabilitiesAtw,
  ): void {
    this.homey.flow
      .getActionCard(`${capability}_action`)
      .registerRunListener(async (args: FlowArgsAtw): Promise<void> => {
        await args.device.onCapability(
          capability as keyof SetCapabilitiesAtw,
          args.target_temperature,
        )
      })
  }
}
