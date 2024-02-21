import {
  type Capabilities,
  type FlowArgs,
  type GetCapabilityMappingAtw,
  type ListCapabilityMappingAtw,
  type OpCapabilities,
  type ReportCapabilityMappingAtw,
  type SetCapabilities,
  type SetCapabilityMappingAtw,
  type Store,
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
} from '../../types/types'
import BaseMELCloudDriver from '../../bases/driver'
import { HeatPumpType } from '../../types/MELCloudAPITypes'

export = class AtwDriver extends BaseMELCloudDriver<'Atw'> {
  public readonly getCapabilityMapping: GetCapabilityMappingAtw =
    getCapabilityMappingAtw

  public readonly listCapabilityMapping: ListCapabilityMappingAtw =
    listCapabilityMappingAtw

  public readonly reportCapabilityMapping: ReportCapabilityMappingAtw =
    reportCapabilityMappingAtw

  public readonly setCapabilityMapping: SetCapabilityMappingAtw =
    setCapabilityMappingAtw

  protected readonly deviceType: HeatPumpType = HeatPumpType.Atw

  readonly #capabilities: (keyof OpCapabilities<AtwDriver>)[] = [
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

  readonly #coolCapabilities: (keyof OpCapabilities<AtwDriver>)[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  readonly #coolZone2Capabilities: (keyof OpCapabilities<AtwDriver>)[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  readonly #flowCapabilities: (keyof Capabilities<AtwDriver>)[] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as (keyof Capabilities<AtwDriver>)[]

  readonly #notCoolCapabilities: (keyof OpCapabilities<AtwDriver>)[] = [
    'operation_mode_zone',
  ]

  readonly #notCoolZone2Capabilities: (keyof OpCapabilities<AtwDriver>)[] = [
    'operation_mode_zone.zone2',
  ]

  readonly #zone2Capabilities: (keyof OpCapabilities<AtwDriver>)[] = [
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
    this.#flowCapabilities.forEach(
      (capability: keyof Capabilities<AtwDriver>) => {
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
      },
    )
  }

  #registerBooleanRunListener(capability: keyof Capabilities<AtwDriver>): void {
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgs<AtwDriver>): boolean =>
          args.device.getCapabilityValue(capability) as boolean,
      )
    if (capability.startsWith('onoff.')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(
          async (args: FlowArgs<AtwDriver>): Promise<void> => {
            await args.device.onCapability(
              capability as keyof SetCapabilities<AtwDriver>,
              args.onoff,
            )
          },
        )
    }
  }

  #registerOperationModeRunListener(
    capability: keyof Capabilities<AtwDriver>,
  ): void {
    const capabilityArg: 'operation_mode_state' | 'operation_mode_zone' =
      capability.startsWith('operation_mode_state')
        ? 'operation_mode_state'
        : 'operation_mode_zone'
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (args: FlowArgs<AtwDriver>): boolean =>
          args[capabilityArg] === args.device.getCapabilityValue(capability),
      )
    if (capability.startsWith('operation_mode_zone')) {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(
          async (args: FlowArgs<AtwDriver>): Promise<void> => {
            await args.device.onCapability(
              capability as keyof SetCapabilities<AtwDriver>,
              args.operation_mode_zone,
            )
          },
        )
    }
  }

  #registerTargetTemperatureRunListener(
    capability: keyof Capabilities<AtwDriver>,
  ): void {
    this.homey.flow
      .getActionCard(`${capability}_action`)
      .registerRunListener(async (args: FlowArgs<AtwDriver>): Promise<void> => {
        await args.device.onCapability(
          capability as keyof SetCapabilities<AtwDriver>,
          args.target_temperature,
        )
      })
  }
}
