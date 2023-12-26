import BaseMELCloudDriver from '../../bases/driver'
import type {
  FlowArgs,
  GetCapabilityAtw,
  GetCapabilityMappingAtw,
  ListCapabilityAtw,
  ListCapabilityMappingAtw,
  ReportCapabilityMappingAtw,
  SetCapabilityAtw,
  SetCapabilityMappingAtw,
  Store,
} from '../../types'

export = class AtwDriver extends BaseMELCloudDriver {
  public readonly heatPumpType = 'Atw'

  /* eslint-disable @typescript-eslint/naming-convention */
  public readonly setCapabilityMapping: SetCapabilityMappingAtw = {
    onoff: { tag: 'Power', effectiveFlag: 0x1n },
    operation_mode_zone: { tag: 'OperationModeZone1', effectiveFlag: 0x8n },
    operation_mode_zone_with_cool: {
      tag: 'OperationModeZone1',
      effectiveFlag: 0x8n,
    },
    'operation_mode_zone.zone2': {
      tag: 'OperationModeZone2',
      effectiveFlag: 0x10n,
    },
    'operation_mode_zone_with_cool.zone2': {
      tag: 'OperationModeZone2',
      effectiveFlag: 0x10n,
    },
    'onoff.forced_hot_water': {
      tag: 'ForcedHotWaterMode',
      effectiveFlag: 0x10000n,
    },
    target_temperature: {
      tag: 'SetTemperatureZone1',
      effectiveFlag: 0x200000080n,
    },
    'target_temperature.zone2': {
      tag: 'SetTemperatureZone2',
      effectiveFlag: 0x800000200n,
    },
    'target_temperature.flow_cool': {
      tag: 'SetCoolFlowTemperatureZone1',
      effectiveFlag: 0x1000000000000n,
    },
    'target_temperature.flow_heat': {
      tag: 'SetHeatFlowTemperatureZone1',
      effectiveFlag: 0x1000000000000n,
    },
    'target_temperature.flow_cool_zone2': {
      tag: 'SetCoolFlowTemperatureZone2',
      effectiveFlag: 0x1000000000000n,
    },
    'target_temperature.flow_heat_zone2': {
      tag: 'SetHeatFlowTemperatureZone2',
      effectiveFlag: 0x1000000000000n,
    },
    'target_temperature.tank_water': {
      tag: 'SetTankWaterTemperature',
      effectiveFlag: 0x1000000000020n,
    },
  } as const

  public readonly getCapabilityMapping: GetCapabilityMappingAtw = {
    'alarm_generic.eco_hot_water': { tag: 'EcoHotWater' },
    measure_temperature: { tag: 'RoomTemperatureZone1' },
    'measure_temperature.zone2': { tag: 'RoomTemperatureZone2' },
    'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
    'measure_temperature.tank_water': { tag: 'TankWaterTemperature' },
    operation_mode_state: { tag: 'OperationMode' },
    // Must follow `operation_mode_state`
    'operation_mode_state.zone1': { tag: 'IdleZone1' },
    'operation_mode_state.zone2': { tag: 'IdleZone2' },
  } as const

  public readonly listCapabilityMapping: ListCapabilityMappingAtw = {
    'measure_power.wifi': { tag: 'WifiSignalStrength' },
    'alarm_generic.booster_heater1': { tag: 'BoosterHeater1Status' },
    'alarm_generic.booster_heater2': { tag: 'BoosterHeater2Status' },
    'alarm_generic.booster_heater2_plus': { tag: 'BoosterHeater2PlusStatus' },
    'alarm_generic.defrost_mode': { tag: 'DefrostMode' },
    'alarm_generic.immersion_heater': { tag: 'ImmersionHeaterStatus' },
    last_legionella: { tag: 'LastLegionellaActivationTime' },
    measure_power: { tag: 'CurrentEnergyConsumed' },
    'measure_power.produced': { tag: 'CurrentEnergyProduced' },
    'measure_power.heat_pump_frequency': { tag: 'HeatPumpFrequency' },
    'measure_temperature.condensing': { tag: 'CondensingTemperature' },
    'measure_temperature.flow': { tag: 'FlowTemperature' },
    'measure_temperature.flow_zone1': { tag: 'FlowTemperatureZone1' },
    'measure_temperature.flow_zone2': { tag: 'FlowTemperatureZone2' },
    'measure_temperature.return': { tag: 'ReturnTemperature' },
    'measure_temperature.return_zone1': { tag: 'ReturnTemperatureZone1' },
    'measure_temperature.return_zone2': { tag: 'ReturnTemperatureZone2' },
    'measure_temperature.tank_water_mixing': {
      tag: 'MixingTankWaterTemperature',
    },
    'measure_temperature.target_curve': { tag: 'TargetHCTemperatureZone1' },
    'measure_temperature.target_curve_zone2': {
      tag: 'TargetHCTemperatureZone2',
    },
  } as const

  public readonly reportCapabilityMapping: ReportCapabilityMappingAtw = {
    meter_power: [
      'TotalCoolingConsumed',
      'TotalHeatingConsumed',
      'TotalHotWaterConsumed',
    ],
    'meter_power.cooling': ['TotalCoolingConsumed'],
    'meter_power.heating': ['TotalHeatingConsumed'],
    'meter_power.hotwater': ['TotalHotWaterConsumed'],
    'meter_power.produced': [
      'TotalCoolingProduced',
      'TotalHeatingProduced',
      'TotalHotWaterProduced',
    ],
    'meter_power.produced_cooling': ['TotalCoolingProduced'],
    'meter_power.produced_heating': ['TotalHeatingProduced'],
    'meter_power.produced_hotwater': ['TotalHotWaterProduced'],
    'meter_power.cop': [
      'TotalCoolingProduced',
      'TotalHeatingProduced',
      'TotalHotWaterProduced',
      'TotalCoolingConsumed',
      'TotalHeatingConsumed',
      'TotalHotWaterConsumed',
    ],
    'meter_power.cop_cooling': ['TotalCoolingProduced', 'TotalCoolingConsumed'],
    'meter_power.cop_heating': ['TotalHeatingProduced', 'TotalHeatingConsumed'],
    'meter_power.cop_hotwater': [
      'TotalHotWaterProduced',
      'TotalHotWaterConsumed',
    ],
    'meter_power.daily': [
      'TotalCoolingConsumed',
      'TotalHeatingConsumed',
      'TotalHotWaterConsumed',
    ],
    'meter_power.daily_cooling': ['TotalCoolingConsumed'],
    'meter_power.daily_heating': ['TotalHeatingConsumed'],
    'meter_power.daily_hotwater': ['TotalHotWaterConsumed'],
    'meter_power.produced_daily': [
      'TotalCoolingProduced',
      'TotalHeatingProduced',
      'TotalHotWaterProduced',
    ],
    'meter_power.produced_daily_cooling': ['TotalCoolingProduced'],
    'meter_power.produced_daily_heating': ['TotalHeatingProduced'],
    'meter_power.produced_daily_hotwater': ['TotalHotWaterProduced'],
    'meter_power.cop_daily': ['CoP'],
    'meter_power.cop_daily_cooling': [
      'TotalCoolingProduced',
      'TotalCoolingConsumed',
    ],
    'meter_power.cop_daily_heating': [
      'TotalHeatingProduced',
      'TotalHeatingConsumed',
    ],
    'meter_power.cop_daily_hotwater': [
      'TotalHotWaterProduced',
      'TotalHotWaterConsumed',
    ],
  } as const
  /* eslint-enable @typescript-eslint/naming-convention */

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
