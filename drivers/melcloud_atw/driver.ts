import BaseMELCloudDriver from '../../bases/driver'
import type MELCloudDeviceAtw from './device'
import {
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
  type GetCapabilityAtw,
  type GetCapabilityMappingAtw,
  type ListCapabilityAtw,
  type ListCapabilityMappingAtw,
  type ReportCapabilityMappingAtw,
  type SetCapabilityAtw,
  type SetCapabilityMappingAtw,
  type Store,
} from '../../types'

export = class MELCloudDriverAtw extends BaseMELCloudDriver {
  public capabilitiesAtw: (
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
    'measure_temperature.target_curve',
    'target_temperature',
    'target_temperature.tank_water',
    'target_temperature.flow_heat',
    'operation_mode_state',
    'measure_power.heat_pump_frequency',
    'measure_power',
    'measure_power.produced',
    'measure_power.wifi',
  ]

  public coolCapabilitiesAtw: SetCapabilityAtw[] = [
    'target_temperature.flow_cool',
    'operation_mode_zone_with_cool',
  ]

  public notCoolCapabilitiesAtw: SetCapabilityAtw[] = ['operation_mode_zone']

  public zone2CapabilitiesAtw: (
    | GetCapabilityAtw
    | ListCapabilityAtw
    | SetCapabilityAtw
  )[] = [
    'measure_temperature.zone2',
    'measure_temperature.target_curve_zone2',
    'target_temperature.zone2',
    'target_temperature.flow_heat_zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
  ]

  public coolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'target_temperature.flow_cool_zone2',
    'operation_mode_zone_with_cool.zone2',
  ]

  public notCoolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone.zone2',
  ]

  public heatPumpType = 'Atw'

  public setCapabilityMapping: SetCapabilityMappingAtw = setCapabilityMappingAtw

  public getCapabilityMapping: GetCapabilityMappingAtw = getCapabilityMappingAtw

  public listCapabilityMapping: ListCapabilityMappingAtw =
    listCapabilityMappingAtw

  public reportCapabilityMapping: ReportCapabilityMappingAtw =
    reportCapabilityMappingAtw

  protected deviceType = 1

  public getRequiredCapabilities({ CanCool, HasZone2 }: Store): string[] {
    return [
      ...this.capabilitiesAtw,
      ...(CanCool ? this.coolCapabilitiesAtw : this.notCoolCapabilitiesAtw),
      ...(HasZone2
        ? [
            ...this.zone2CapabilitiesAtw,
            ...(CanCool
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
                (args: {
                  device: MELCloudDeviceAtw
                  operation_mode_state: string
                }): boolean =>
                  args.operation_mode_state ===
                  args.device.getCapabilityValue(capability),
              )
            break
          case capability.startsWith('alarm_generic') ||
            capability.startsWith('onoff.'):
            this.homey.flow
              .getConditionCard(`${capability}_condition`)
              .registerRunListener(
                (args: { device: MELCloudDeviceAtw }): boolean =>
                  args.device.getCapabilityValue(capability),
              )
            if (capability.startsWith('onoff.')) {
              this.homey.flow
                .getActionCard(`${capability}_action`)
                .registerRunListener(
                  async (args: {
                    device: MELCloudDeviceAtw
                    onoff: 'false' | 'true'
                  }): Promise<void> => {
                    await args.device.triggerCapabilityListener(
                      capability,
                      args.onoff === 'true',
                    )
                  },
                )
            }
            break
          case capability.startsWith('operation_mode_zone'):
            this.homey.flow
              .getConditionCard(`${capability}_condition`)
              .registerRunListener(
                (args: {
                  device: MELCloudDeviceAtw
                  operation_mode_zone: string
                }): boolean =>
                  args.operation_mode_zone ===
                  args.device.getCapabilityValue(capability),
              )
            this.homey.flow
              .getActionCard(`${capability}_action`)
              .registerRunListener(
                async (args: {
                  device: MELCloudDeviceAtw
                  operation_mode_zone: string
                }): Promise<void> => {
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
                async (args: {
                  device: MELCloudDeviceAtw
                  target_temperature: number
                }): Promise<void> => {
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
