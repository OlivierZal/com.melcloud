import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
  HeatPumpType,
  type Capabilities,
  type FlowArgs,
  type GetCapabilityMappingAtw,
  type ListCapabilityMappingAtw,
  type ReportCapabilityMappingAtw,
  type SetCapabilities,
  type SetCapabilityMappingAtw,
  type Store,
} from '../../types'

export = class AtwDriver extends BaseMELCloudDriver<AtwDriver> {
  public readonly setCapabilityMapping: SetCapabilityMappingAtw =
    setCapabilityMappingAtw

  public readonly getCapabilityMapping: GetCapabilityMappingAtw =
    getCapabilityMappingAtw

  public readonly listCapabilityMapping: ListCapabilityMappingAtw =
    listCapabilityMappingAtw

  public readonly reportCapabilityMapping: ReportCapabilityMappingAtw =
    reportCapabilityMappingAtw

  protected readonly deviceType: HeatPumpType = HeatPumpType.Atw

  readonly #capabilities: (keyof Capabilities<AtwDriver>)[] = [
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

  readonly #coolCapabilities: (keyof SetCapabilities<AtwDriver>)[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  readonly #notCoolCapabilities: (keyof SetCapabilities<AtwDriver>)[] = [
    'operation_mode_zone',
  ]

  readonly #zone2Capabilities: (keyof Capabilities<AtwDriver>)[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  readonly #coolZone2Capabilities: (keyof SetCapabilities<AtwDriver>)[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  readonly #notCoolZone2Capabilities: (keyof SetCapabilities<AtwDriver>)[] = [
    'operation_mode_zone.zone2',
  ]

  readonly #flowCapabilities: (keyof Capabilities<AtwDriver>)[] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as (keyof Capabilities<AtwDriver>)[]

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

  protected registerFlowListeners(): void {
    this.#flowCapabilities.forEach(
      (capability: keyof Capabilities<AtwDriver>): void => {
        switch (true) {
          case capability.startsWith('operation_mode_state'):
            this.homey.flow
              .getConditionCard(`${capability}_condition`)
              .registerRunListener(
                (args: FlowArgs<AtwDriver>): boolean =>
                  args.operation_mode_state ===
                  args.device.getCapabilityValue(capability),
              )
            break
          case capability.startsWith('alarm_generic'):
          case capability.startsWith('onoff.'):
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
            break
          case capability.startsWith('operation_mode_zone'):
            this.homey.flow
              .getConditionCard(`${capability}_condition`)
              .registerRunListener(
                (args: FlowArgs<AtwDriver>): boolean =>
                  args.operation_mode_zone ===
                  args.device.getCapabilityValue(capability),
              )
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
            break
          case capability.startsWith('target_temperature.'):
            this.homey.flow
              .getActionCard(`${capability}_action`)
              .registerRunListener(
                async (args: FlowArgs<AtwDriver>): Promise<void> => {
                  await args.device.onCapability(
                    capability as keyof SetCapabilities<AtwDriver>,
                    args.target_temperature,
                  )
                },
              )
            break
          default:
        }
      },
    )
  }
}
