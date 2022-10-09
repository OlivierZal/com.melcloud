const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudAtwDriver extends Homey.Driver {
  async onInit() {
    this.deviceType = 1;
    this.heatPumpType = 'Atw';

    this.atwCapabilities = [
      'alarm_generic.booster_heater1',
      'alarm_generic.booster_heater2',
      'alarm_generic.booster_heater2_plus',
      'alarm_generic.defrost_mode',
      'alarm_water.immersion_heater',
      'eco_hot_water',
      'measure_power.daily_cop',
      'measure_power.daily_produced',
      'measure_power.daily_consumed',
      'measure_power.daily_cop_cooling',
      'measure_power.daily_produced_cooling',
      'measure_power.daily_consumed_cooling',
      'measure_power.daily_cop_heating',
      'measure_power.daily_produced_heating',
      'measure_power.daily_consumed_heating',
      'measure_power.daily_cop_hotwater',
      'measure_power.daily_produced_hotwater',
      'measure_power.daily_consumed_hotwater',
      'measure_power.total_cop',
      'measure_power.total_produced',
      'measure_power.total_consumed',
      'measure_power.total_cop_cooling',
      'measure_power.total_produced_cooling',
      'measure_power.total_consumed_cooling',
      'measure_power.total_cop_heating',
      'measure_power.total_produced_heating',
      'measure_power.total_consumed_heating',
      'measure_power.total_cop_hotwater',
      'measure_power.total_produced_hotwater',
      'measure_power.total_consumed_hotwater',
      'measure_power.heat_pump_frequency',
      'measure_temperature',
      'measure_temperature.flow',
      'measure_temperature.outdoor',
      'measure_temperature.return',
      'onoff',
      'onoff.forced_hot_water',
      'operation_mode_state',
      'target_temperature',
      'target_temperature.zone1_flow_heat',
    ];
    this.coolAtwCapabilities = [
      'operation_mode_zone_with_cool.zone1',
      'target_temperature.zone1_flow_cool',
    ];
    this.notCoolAtwCapabilities = [
      'operation_mode_zone.zone1',
    ];
    this.zone2AtwCapabilities = [
      'measure_temperature.zone2',
      'target_temperature.zone2',
      'target_temperature.zone2_flow_heat',
    ];
    this.coolZone2AtwCapabilities = [
      'operation_mode_zone_with_cool.zone2',
      'target_temperature.zone2_flow_cool',
    ];
    this.notCoolZone2AtwCapabilities = [
      'operation_mode_zone.zone2',
    ];
    this.otherAtwCapabilities = [
      'measure_temperature.tank_water',
      'target_temperature.tank_water',
    ];

    // Condition flowcards
    this.homey.flow
      .getConditionCard('eco_hot_water_condition')
      .registerRunListener((args) => args.eco_hot_water === String(args.device.getCapabilityValue('eco_hot_water')));

    this.homey.flow
      .getConditionCard('operation_mode_state_condition')
      .registerRunListener((args) => args.operation_mode_state === args.device.getCapabilityValue('operation_mode_state'));

    this.homey.flow
      .getConditionCard('operation_mode_zone1_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone1'));

    this.homey.flow
      .getConditionCard('operation_mode_zone1_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone1'));

    this.homey.flow
      .getConditionCard('operation_mode_zone2_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone2'));

    this.homey.flow
      .getConditionCard('operation_mode_zone2_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone2'));

    // Action flowcards
    this.homey.flow
      .getActionCard('operation_mode_zone1_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone1(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone1_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone1(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone2_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone2(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone2_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone2(args.operation_mode_zone);
      });
  }

  async discoverDevices() {
    const deviceList = await this.homey.app.listDevices(this);
    const devices = deviceList.map((device) => {
      const deviceInfo = {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID,
        },
        store: {
          canCool: device.Device.CanCool,
          hasZone2: device.Device.HasZone2,
        },
        capabilities: [],
      };
      this.atwCapabilities.forEach((capability) => {
        deviceInfo.capabilities.push(capability);
      });
      if (device.Device.CanCool) {
        this.coolAtwCapabilities.forEach((capability) => {
          deviceInfo.capabilities.push(capability);
        });
      } else {
        this.notCoolAtwCapabilities.forEach((capability) => {
          deviceInfo.capabilities.push(capability);
        });
      }
      if (device.Device.HasZone2) {
        this.zone2AtwCapabilities.forEach((capability) => {
          deviceInfo.capabilities.push(capability);
        });
        if (device.Device.CanCool) {
          this.coolZone2AtwCapabilities.forEach((capability) => {
            deviceInfo.capabilities.push(capability);
          });
        } else {
          this.notCoolZone2AtwCapabilities.forEach((capability) => {
            deviceInfo.capabilities.push(capability);
          });
        }
      }
      this.otherAtwCapabilities.forEach((capability) => {
        deviceInfo.capabilities.push(capability);
      });
      return deviceInfo;
    });
    return devices;
  }

  onPair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
    session.setHandler('list_devices', async () => this.discoverDevices());
  }
}

module.exports = MELCloudAtwDriver;
