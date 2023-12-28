import BaseMELCloudDriver from '../../bases/driver'
import type {
  FlowArgs,
  GetCapabilityMappingErv,
  ListCapabilityMappingErv,
  SetCapabilityErv,
  SetCapabilityMappingErv,
  Store,
} from '../../types'

const flowCapabilities: SetCapabilityErv[] = ['ventilation_mode', 'fan_power']

export = class ErvDriver extends BaseMELCloudDriver {
  public readonly heatPumpType: string = 'Erv'

  public readonly setCapabilityMapping: SetCapabilityMappingErv = {
    onoff: { tag: 'Power', effectiveFlag: 0x1n },
    ventilation_mode: { tag: 'VentilationMode', effectiveFlag: 0x4n },
    fan_power: { tag: 'SetFanSpeed', effectiveFlag: 0x8n },
  } as const

  public readonly getCapabilityMapping: GetCapabilityMappingErv = {
    measure_co2: { tag: 'RoomCO2Level' },
    measure_temperature: { tag: 'RoomTemperature' },
    'measure_temperature.outdoor': { tag: 'OutdoorTemperature' },
  } as const

  public readonly listCapabilityMapping: ListCapabilityMappingErv = {
    'measure_power.wifi': { tag: 'WifiSignalStrength' },
    measure_pm25: { tag: 'PM25Level' },
  } as const

  protected readonly deviceType = 3

  public getRequiredCapabilities({
    hasCO2Sensor,
    hasPM25Sensor,
  }: Store): string[] {
    return [
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      ...(this.manifest.capabilities as string[]).filter(
        (capability: string) =>
          !['measure_co2', 'measure_pm25', 'measure_power.wifi'].includes(
            capability,
          ),
      ),
      ...(hasCO2Sensor ? ['measure_co2'] : []),
      ...(hasPM25Sensor ? ['measure_pm25'] : []),
    ]
  }

  protected registerFlowListeners(): void {
    const getCapabilityArg = (
      args: FlowArgs<ErvDriver>,
      capability: SetCapabilityErv,
    ): number | string => {
      if (capability === 'fan_power') {
        return Number(args[capability])
      }
      return args[capability]
    }

    flowCapabilities.forEach((capability: SetCapabilityErv): void => {
      this.homey.flow
        .getConditionCard(`${capability}_erv_condition`)
        .registerRunListener(
          (args: FlowArgs<ErvDriver>): boolean =>
            getCapabilityArg(args, capability) ===
            args.device.getCapabilityValue(capability),
        )
      this.homey.flow
        .getActionCard(`${capability}_erv_action`)
        .registerRunListener(
          async (args: FlowArgs<ErvDriver>): Promise<void> => {
            await args.device.triggerCapabilityListener(
              capability,
              getCapabilityArg(args, capability),
            )
          },
        )
    })
  }
}
