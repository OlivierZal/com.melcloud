import BaseMELCloudDriver from '../../bases/driver'
import type MELCloudDeviceAtw from './device'
import {
  getCapabilityMappingAtw,
  listCapabilityMappingAtw,
  reportCapabilityMappingAtw,
  setCapabilityMappingAtw,
  type GetCapabilityAtw,
  type ListCapabilityAtw,
  type SetCapabilityAtw,
  type Store,
} from '../../types'

export = class MELCloudDriverAtw extends BaseMELCloudDriver {
  capabilitiesAtw: (SetCapabilityAtw | GetCapabilityAtw | ListCapabilityAtw)[] =
    [
      'measure_power.heat_pump_frequency',
      'measure_temperature',
      'measure_temperature.outdoor',
      'measure_temperature.flow',
      'measure_temperature.return',
      'measure_temperature.tank_water',
      'onoff',
      'onoff.forced_hot_water',
      'operation_mode_state',
      'target_temperature',
      'target_temperature.tank_water',
      'target_temperature.zone1_flow_heat',
    ]

  coolCapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone_with_cool.zone1',
    'target_temperature.zone1_flow_cool',
  ]

  notCoolCapabilitiesAtw: SetCapabilityAtw[] = ['operation_mode_zone.zone1']

  zone2CapabilitiesAtw: (SetCapabilityAtw | GetCapabilityAtw)[] = [
    'measure_temperature.zone2',
    'operation_mode_state.zone1',
    'operation_mode_state.zone2',
    'target_temperature.zone2',
    'target_temperature.zone2_flow_heat',
  ]

  coolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone_with_cool.zone2',
    'target_temperature.zone2_flow_cool',
  ]

  notCoolZone2CapabilitiesAtw: SetCapabilityAtw[] = [
    'operation_mode_zone.zone2',
  ]

  async onInit(): Promise<void> {
    await super.onInit()
    this.deviceType = 1
    this.heatPumpType = 'Atw'

    this.setCapabilityMapping = setCapabilityMappingAtw
    this.getCapabilityMapping = getCapabilityMappingAtw
    this.listCapabilityMapping = listCapabilityMappingAtw
    this.reportCapabilityMapping = reportCapabilityMappingAtw

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    ;(this.manifest.capabilities as SetCapabilityAtw[]).forEach(
      (capability: SetCapabilityAtw): void => {
        if (capability.startsWith('operation_mode_state')) {
          this.homey.flow
            .getConditionCard(`${capability}_condition`)
            .registerRunListener(
              (args: {
                device: MELCloudDeviceAtw
                operation_mode_state: string
              }): boolean =>
                args.operation_mode_state ===
                args.device.getCapabilityValue('operation_mode_state'),
            )
        } else if (
          capability.startsWith('alarm_generic') ||
          capability.startsWith('onoff.')
        ) {
          this.homey.flow
            .getConditionCard(`${capability}_condition`)
            .registerRunListener(
              (args: { device: MELCloudDeviceAtw }): boolean =>
                args.device.getCapabilityValue(capability),
            )
          if (capability.startsWith('onoff')) {
            this.homey.flow
              .getActionCard(`${capability}_action`)
              .registerRunListener(
                async (args: {
                  device: MELCloudDeviceAtw
                  onoff: 'true' | 'false'
                }): Promise<void> => {
                  await args.device.onCapability(
                    capability,
                    args.onoff === 'true',
                  )
                },
              )
          }
        } else if (capability.startsWith('operation_mode_zone')) {
          let flowPrefix = `operation_mode_zone${capability.slice(-1)}`
          if (capability.includes('with_cool')) {
            flowPrefix += '_with_cool'
          }
          this.homey.flow
            .getConditionCard(`${flowPrefix}_condition`)
            .registerRunListener(
              (args: {
                device: MELCloudDeviceAtw
                operation_mode_zone: string
              }): boolean =>
                args.operation_mode_zone ===
                args.device.getCapabilityValue(capability),
            )
          this.homey.flow
            .getActionCard(`${flowPrefix}_action`)
            .registerRunListener(
              async (args: {
                device: MELCloudDeviceAtw
                operation_mode_zone: string
              }): Promise<void> => {
                await args.device.onCapability(
                  capability,
                  args.operation_mode_zone,
                )
              },
            )
        } else if (capability.startsWith('target_temperature.')) {
          this.homey.flow
            .getActionCard(`${capability.replace(/\./g, '_')}_action`)
            .registerRunListener(
              async (args: {
                device: MELCloudDeviceAtw
                target_temperature: number
              }): Promise<void> => {
                await args.device.onCapability(
                  capability,
                  args.target_temperature,
                )
              },
            )
        }
      },
    )

    // Deprecated
    this.homey.flow
      .getConditionCard('onoff_forced_hot_water_condition')
      .registerRunListener(
        (args: {
          device: MELCloudDeviceAtw
          onoff_forced_hot_water: 'true' | 'false'
        }): boolean =>
          args.onoff_forced_hot_water ===
          String(args.device.getCapabilityValue('onoff.forced_hot_water')),
      )
    this.homey.flow
      .getActionCard('onoff_forced_hot_water_action')
      .registerRunListener(
        async (args: {
          device: MELCloudDeviceAtw
          onoff_forced_hot_water: 'true' | 'false'
        }): Promise<void> => {
          await args.device.onCapability(
            'onoff.forced_hot_water',
            args.onoff_forced_hot_water === 'true',
          )
        },
      )
    this.homey.flow
      .getActionCard('target_temperature_tank_water')
      .registerRunListener(
        async (args: {
          device: MELCloudDeviceAtw
          target_temperature: number
        }): Promise<void> => {
          await args.device.onCapability(
            'target_temperature.tank_water',
            args.target_temperature,
          )
        },
      )
  }

  getRequiredCapabilities({ CanCool, HasZone2 }: Store): string[] {
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
      'measure_power',
      'measure_power.produced',
    ]
  }
}
