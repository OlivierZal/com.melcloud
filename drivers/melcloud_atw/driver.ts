import BaseMELCloudDriver from '../../bases/driver'
import {
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
  type FlowArgs,
  type GetCapabilityAtw,
  type GetCapabilityMappingAtw,
  type ListCapabilityAtw,
  type ListCapabilityMappingAtw,
  type ReportCapabilityMappingAtw,
  type SetCapabilityAtw,
  type SetCapabilityMappingAtw,
  type Store,
} from '../../types'

export = class AtwDriver extends BaseMELCloudDriver {
  public readonly heatPumpType = 'Atw'

  public readonly setCapabilityMapping: SetCapabilityMappingAtw =
    setCapabilityMappingAtw

  public readonly getCapabilityMapping: GetCapabilityMappingAtw =
    getCapabilityMappingAtw

  public readonly listCapabilityMapping: ListCapabilityMappingAtw =
    listCapabilityMappingAtw

  public readonly reportCapabilityMapping: ReportCapabilityMappingAtw =
    reportCapabilityMappingAtw

  public readonly capabilitiesAtw: (
    | GetCapabilityAtw
    | ListCapabilityAtw
    | SetCapabilityAtw
  )[] = [
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

  public readonly coolCapabilitiesAtw: SetCapabilityAtw[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  public readonly notCoolCapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone',
  ]

  public readonly zone2CapabilitiesAtw: (
    | GetCapabilityAtw
    | ListCapabilityAtw
    | SetCapabilityAtw
  )[] = [
    'measure_temperature.zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  public readonly coolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  public readonly notCoolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone.zone2',
  ]

  protected readonly deviceType = 1

  public getRequiredCapabilities({ canCool, hasZone2 }: Store): string[] {
    return [
      ...this.capabilitiesAtw,
      ...(canCool ? this.coolCapabilitiesAtw : this.notCoolCapabilitiesAtw),
      ...(hasZone2
        ? [
            ...this.zone2CapabilitiesAtw,
            ...(canCool
              ? this.coolZone2CapabilitiesAtw
              : this.notCoolZone2CapabilitiesAtw),
          ]
        : []),
    ]
  }

  protected registerFlowListeners(): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ;(this.manifest.capabilities as SetCapabilityAtw[]).forEach(
      (capability: SetCapabilityAtw): void => {
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
          case capability.startsWith('alarm_generic') ||
            capability.startsWith('onoff.'):
            this.homey.flow
              .getConditionCard(`${capability}_condition`)
              .registerRunListener((args: FlowArgs<AtwDriver>): boolean =>
                args.device.getCapabilityValue(capability),
              )
            if (capability.startsWith('onoff.')) {
              this.homey.flow
                .getActionCard(`${capability}_action`)
                .registerRunListener(
                  async (args: FlowArgs<AtwDriver>): Promise<void> => {
                    await args.device.triggerCapabilityListener(
                      capability,
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
                  await args.device.triggerCapabilityListener(
                    capability,
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
                  await args.device.triggerCapabilityListener(
                    capability,
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
