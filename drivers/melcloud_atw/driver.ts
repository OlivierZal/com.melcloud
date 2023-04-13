import MELCloudDriverMixin from '../../mixins/driver_mixin'
import type MELCloudDeviceAtw from './device'
import {
  type GetCapability,
  type ListCapability,
  type SetCapability
} from '../../types'

export default class MELCloudDriverAtw extends MELCloudDriverMixin {
  capabilitiesAtw!: Array<
    | SetCapability<MELCloudDeviceAtw>
    | GetCapability<MELCloudDeviceAtw>
    | ListCapability<MELCloudDeviceAtw>
  >

  coolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolCapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  zone2CapabilitiesAtw!: Array<
    SetCapability<MELCloudDeviceAtw> | GetCapability<MELCloudDeviceAtw>
  >

  coolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>
  notCoolZone2CapabilitiesAtw!: Array<SetCapability<MELCloudDeviceAtw>>

  async onInit(): Promise<void> {
    await super.onInit()
    this.deviceType = 1
    this.heatPumpType = 'Atw'

    this.capabilitiesAtw = [
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
      'target_temperature.zone1_flow_heat'
    ]
    this.coolCapabilitiesAtw = [
      'operation_mode_zone_with_cool.zone1',
      'target_temperature.zone1_flow_cool'
    ]
    this.notCoolCapabilitiesAtw = ['operation_mode_zone.zone1']
    this.zone2CapabilitiesAtw = [
      'measure_temperature.zone2',
      'operation_mode_state.zone1',
      'operation_mode_state.zone2',
      'target_temperature.zone2',
      'target_temperature.zone2_flow_heat'
    ]
    this.coolZone2CapabilitiesAtw = [
      'operation_mode_zone_with_cool.zone2',
      'target_temperature.zone2_flow_cool'
    ]
    this.notCoolZone2CapabilitiesAtw = ['operation_mode_zone.zone2']

    const operationModeStateCapabilities: Array<
      SetCapability<MELCloudDeviceAtw>
    > = this.manifest.capabilities.filter(
      (capability: SetCapability<MELCloudDeviceAtw>): boolean =>
        capability.startsWith('operation_mode_state')
    )
    operationModeStateCapabilities.forEach(
      (capability: SetCapability<MELCloudDeviceAtw>): void => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (args: {
              device: MELCloudDeviceAtw
              operation_mode_state: string
            }): boolean =>
              args.operation_mode_state ===
              args.device.getCapabilityValue('operation_mode_state')
          )
      }
    )

    const booleanCapabilities: Array<SetCapability<MELCloudDeviceAtw>> =
      this.manifest.capabilities.filter(
        (capability: SetCapability<MELCloudDeviceAtw>): boolean =>
          capability.startsWith('alarm_generic') ||
          capability.startsWith('onoff.')
      )
    booleanCapabilities.forEach(
      (capability: SetCapability<MELCloudDeviceAtw>): void => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener((args: { device: MELCloudDeviceAtw }): boolean =>
            args.device.getCapabilityValue(capability)
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
                  args.onoff === 'true'
                )
              }
            )
        }
      }
    )

    const operationModeZoneCapabilities: Array<
      SetCapability<MELCloudDeviceAtw>
    > = this.manifest.capabilities.filter(
      (capability: SetCapability<MELCloudDeviceAtw>): boolean =>
        capability.startsWith('operation_mode_zone')
    )
    operationModeZoneCapabilities.forEach(
      (capability: SetCapability<MELCloudDeviceAtw>): void => {
        let flowPrefix: string = `operation_mode_zone${
          capability[capability.length - 1]
        }`
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
              args.device.getCapabilityValue(capability)
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
                args.operation_mode_zone
              )
            }
          )
      }
    )

    const flowTemperatureCapabilities: Array<SetCapability<MELCloudDeviceAtw>> =
      this.manifest.capabilities.filter(
        (capability: SetCapability<MELCloudDeviceAtw>): boolean =>
          capability.startsWith('target_temperature.')
      )
    flowTemperatureCapabilities.forEach(
      (capability: SetCapability<MELCloudDeviceAtw>): void => {
        this.homey.flow
          .getActionCard(`${capability.replace(/\./g, '_')}_action`)
          .registerRunListener(
            async (args: {
              device: MELCloudDeviceAtw
              target_temperature: number
            }): Promise<void> => {
              await args.device.onCapability(
                capability,
                args.target_temperature
              )
            }
          )
      }
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
          String(args.device.getCapabilityValue('onoff.forced_hot_water'))
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
            args.onoff_forced_hot_water === 'true'
          )
        }
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
            args.target_temperature
          )
        }
      )
  }

  getRequiredCapabilities(canCool: boolean, hasZone2: boolean): string[] {
    return [
      ...this.capabilitiesAtw,
      ...(canCool ? this.coolCapabilitiesAtw : this.notCoolCapabilitiesAtw),
      ...(hasZone2
        ? [
            ...this.zone2CapabilitiesAtw,
            ...(canCool
              ? this.coolZone2CapabilitiesAtw
              : this.notCoolZone2CapabilitiesAtw)
          ]
        : []),
      'measure_power.cop',
      'measure_power.produced'
    ]
  }
}

module.exports = MELCloudDriverAtw
