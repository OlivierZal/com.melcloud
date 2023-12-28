import BaseMELCloudDriver from '../../bases/driver'
import type {
  FlowArgs,
  GetCapabilityMappingAta,
  ListCapabilityMappingAta,
  ReportCapabilityMappingAta,
  SetCapabilityAta,
  SetCapabilityMappingAta,
} from '../../types'

const flowCapabilities: SetCapabilityAta[] = [
  'operation_mode',
  'fan_power',
  'vertical',
  'horizontal',
]

export = class AtaDriver extends BaseMELCloudDriver {
  public readonly heatPumpType: string = 'Ata'

  public readonly setCapabilityMapping: SetCapabilityMappingAta = {
    onoff: { tag: 'Power', effectiveFlag: 0x1n },
    operation_mode: { tag: 'OperationMode', effectiveFlag: 0x2n },
    target_temperature: { tag: 'SetTemperature', effectiveFlag: 0x4n },
    fan_power: { tag: 'SetFanSpeed', effectiveFlag: 0x8n },
    vertical: { tag: 'VaneVertical', effectiveFlag: 0x10n },
    horizontal: { tag: 'VaneHorizontal', effectiveFlag: 0x100n },
  } as const

  public readonly getCapabilityMapping: GetCapabilityMappingAta = {
    measure_temperature: { tag: 'RoomTemperature' },
  } as const

  public readonly listCapabilityMapping: ListCapabilityMappingAta = {
    'measure_power.wifi': { tag: 'WifiSignalStrength' },
    fan_power: { tag: 'FanSpeed' },
    fan_power_state: { tag: 'ActualFanSpeed' },
    vertical: { tag: 'VaneVerticalDirection' },
    horizontal: { tag: 'VaneHorizontalDirection' },
  } as const

  public readonly reportCapabilityMapping: ReportCapabilityMappingAta = {
    measure_power: ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'],
    'measure_power.auto': ['Auto'],
    'measure_power.cooling': ['Cooling'],
    'measure_power.dry': ['Dry'],
    'measure_power.fan': ['Fan'],
    'measure_power.heating': ['Heating'],
    'measure_power.other': ['Other'],
    meter_power: [
      'TotalAutoConsumed',
      'TotalCoolingConsumed',
      'TotalDryConsumed',
      'TotalFanConsumed',
      'TotalHeatingConsumed',
      'TotalOtherConsumed',
    ],
    'meter_power.auto': ['TotalAutoConsumed'],
    'meter_power.cooling': ['TotalCoolingConsumed'],
    'meter_power.dry': ['TotalDryConsumed'],
    'meter_power.fan': ['TotalFanConsumed'],
    'meter_power.heating': ['TotalHeatingConsumed'],
    'meter_power.other': ['TotalOtherConsumed'],
    'meter_power.daily': [
      'TotalAutoConsumed',
      'TotalCoolingConsumed',
      'TotalDryConsumed',
      'TotalFanConsumed',
      'TotalHeatingConsumed',
      'TotalOtherConsumed',
    ],
    'meter_power.daily_auto': ['TotalAutoConsumed'],
    'meter_power.daily_cooling': ['TotalCoolingConsumed'],
    'meter_power.daily_dry': ['TotalDryConsumed'],
    'meter_power.daily_fan': ['TotalFanConsumed'],
    'meter_power.daily_heating': ['TotalHeatingConsumed'],
    'meter_power.daily_other': ['TotalOtherConsumed'],
  } as const

  protected readonly deviceType = 0

  public getRequiredCapabilities(): string[] {
    return [
      ...Object.keys({
        ...this.setCapabilityMapping,
        ...this.getCapabilityMapping,
        ...this.listCapabilityMapping,
      }).filter((capability: string) => capability !== 'measure_power.wifi'),
      'thermostat_mode',
    ]
  }

  protected registerFlowListeners(): void {
    const getCapabilityArg = (
      args: FlowArgs<AtaDriver>,
      capability: SetCapabilityAta,
    ): number | string => {
      if (capability === 'fan_power') {
        return Number(args[capability])
      }
      return args[capability]
    }

    flowCapabilities.forEach((capability: SetCapabilityAta): void => {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener(
          (args: FlowArgs<AtaDriver>): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability),
        )
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(
          async (args: FlowArgs<AtaDriver>): Promise<void> => {
            await args.device.triggerCapabilityListener(
              capability,
              getCapabilityArg(args, capability),
            )
          },
        )
    })
  }
}
