const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudAtaDriver extends Homey.Driver {
  async onInit() {
    this.deviceType = 0;
    this.heatPumpType = 'Ata';

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
      .registerRunListener((args) => args.hotizontal === args.device.getCapabilityValue('horizontal'));

    // Action flowcards
    this.homey.flow
      .getActionCard('operation_mode_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationMode(args.operation_mode);
      });

    this.homey.flow
      .getActionCard('fan_power_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityFanSpeed(Number(args.fan_power));
      });

    this.homey.flow
      .getActionCard('vertical_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityVaneVertical(args.vertical);
      });

    this.homey.flow
      .getActionCard('horizontal_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityVaneHorizontal(args.vertical);
      });
  }

  async discoverDevices() {
    const deviceList = await this.homey.app.listDevices(this);
    const devices = deviceList.map((device) => (
      {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID,
        },
      }
    ));
    return devices;
  }

  onPair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
    session.setHandler('list_devices', async () => this.discoverDevices());
  }
}

module.exports = MELCloudAtaDriver;
