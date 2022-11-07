const MELCloudDriverMixin = require('../../mixins/driver_mixin');

class MELCloudAtaDriver extends MELCloudDriverMixin {
  async onInit() {
    this.deviceType = 0;
    this.heatPumpType = 'Ata';

    this.setCapabilityMapping = {
      onoff: ['Power', BigInt(0x1)],
      operation_mode: ['OperationMode', BigInt(0x2)],
      target_temperature: ['SetTemperature', BigInt(0x4)],
      fan_power: ['SetFanSpeed', BigInt(0x8)],
      vertical: ['VaneVertical', BigInt(0x10)],
      horizontal: ['VaneHorizontal', BigInt(0x100)],
    };
    this.getCapabilityMapping = {
      measure_temperature: 'RoomTemperature',
    };
    this.listCapabilityMapping = {
      'measure_power.wifi': 'WifiSignalStrength',
    };

    // Condition flowcards
    this.homey.flow
      .getConditionCard('operation_mode_condition')
      .registerRunListener((args) => args.operation_mode === args.device.getCapabilityValue('operation_mode'));

    this.homey.flow
      .getConditionCard('fan_power_condition')
      .registerRunListener((args) => Number(args.fan_power) === args.device.getCapabilityValue('fan_power'));

    this.homey.flow
      .getConditionCard('vertical_condition')
      .registerRunListener((args) => args.vertical === args.device.getCapabilityValue('vertical'));

    this.homey.flow
      .getConditionCard('horizontal_condition')
      .registerRunListener((args) => args.horizontal === args.device.getCapabilityValue('horizontal'));

    // Action flowcards
    this.homey.flow
      .getActionCard('operation_mode_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('operation_mode', args.operation_mode);
      });

    this.homey.flow
      .getActionCard('fan_power_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('fan_power', Number(args.fan_power));
      });

    this.homey.flow
      .getActionCard('vertical_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('vertical', args.vertical);
      });

    this.homey.flow
      .getActionCard('horizontal_action')
      .registerRunListener(async (args) => {
        await args.device.onCapability('horizontal', args.horizontal);
      });
  }

  async discoverDevices() {
    const listDevices = await this.homey.app.listDevices(this);
    const deviceList = Object.values(listDevices).map((device) => (
      {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID,
        },
      }
    ));
    return deviceList;
  }
}

module.exports = MELCloudAtaDriver;
