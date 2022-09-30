const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudDeviceAtw extends Homey.Device {
  async migrateCapabilities() {
    const addedCapabilities = [
      'booster_heater1',
      'booster_heater2',
      'booster_heater2_plus',
      'defrost_mode',
      'eco_hot_water',
      'flow_temperature',
      'heat_pump_frequency',
      'immersion_heater',
      'return_temperature',
      'operation_mode_state',
      'onoff',
    ];
    const removedCapabilities = [
    ];

    addedCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
        this.log(`\`${this.getName()}\`: capability \`${capability}\` has been added`);
      }
    });
    removedCapabilities.forEach((capability) => {
      if (this.hasCapability(capability)) {
        this.removeCapability(capability);
        this.log(`\`${this.getName()}\`: capability \`${capability}\` has been removed`);
      }
    });
  }

  async onAdded() {
    await this.onInit();
  }

  async onInit() {
    await this.migrateCapabilities();

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
    await this.syncDataFromDevice();
  }

  async syncDataFromDevice() {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const options = {
      uri: `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      this.log(`\`${this.getName()}\`: syncing from device`);
      await http.get(options).then(async (result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        this.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }

        // Get settings
        const settings = this.getSettings();

        // Get data
        let coolFlowTemperature;
        let heatFlowTemperature;
        let measureTemperature;
        let operationModeZone;
        let targetTemperature;
        if (data.zone === 2) {
          coolFlowTemperature = result.data.SetCoolFlowTemperatureZone2;
          heatFlowTemperature = result.data.SetHeatFlowTemperatureZone2;
          measureTemperature = result.data.RoomTemperatureZone2;
          operationModeZone = String(result.data.OperationModeZone2);
          targetTemperature = result.data.SetTemperatureZone2;
        } else {
          coolFlowTemperature = result.data.SetCoolFlowTemperatureZone1;
          heatFlowTemperature = result.data.SetHeatFlowTemperatureZone1;
          measureTemperature = result.data.RoomTemperatureZone1;
          operationModeZone = String(result.data.OperationModeZone1);
          targetTemperature = result.data.SetTemperatureZone1;
        }

        // Update settings
        await this.setSettings({
          cool_flow_temperature: coolFlowTemperature,
          forced_hot_water: result.data.ForcedHotWaterMode,
          heat_flow_temperature: heatFlowTemperature,
          operation_mode_zone: operationModeZone,
          set_watertank_temperature: result.data.SetTankWaterTemperature,
        });

        // Update capabilities
        await this.setCapabilityValue('eco_hot_water', result.data.EcoHotWater)
          .then(this.log(`\`${this.getName()}\`: capability \`eco_hot_water\` has been set (${result.data.EcoHotWater})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`eco_hot_water\` has not been set (${error})`));
        await this.setCapabilityValue('measure_temperature', measureTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature\` has been set (${measureTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature\` has not been set (${error})`));
        await this.setCapabilityValue('onoff', result.data.Power)
          .then(this.log(`\`${this.getName()}\`: capability \`onoff\` has been set (${result.data.Power})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));
        await this.setCapabilityValue('outdoor_temperature', result.data.OutdoorTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`outdoor_temperature\` has been set (${result.data.OutdoorTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`outdoor_temperature\` has not been set (${error})`));

        const currentOperationMode = this.getCapabilityValue('operation_mode_state');
        const operationMode = String(result.data.OperationMode);
        await this.setCapabilityValue('operation_mode_state', operationMode)
          .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_state\` has been set (${operationMode})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_state\` has not been set (${error})`));

        const minTargetTemperature = 10;
        const maxTargetTemperature = 30;
        if (targetTemperature < minTargetTemperature) {
          await this.setCapabilityValue('target_temperature', minTargetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${minTargetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        } else if (targetTemperature > maxTargetTemperature) {
          await this.setCapabilityValue('target_temperature', maxTargetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${maxTargetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        } else {
          await this.setCapabilityValue('target_temperature', targetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${targetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        }

        await this.setCapabilityValue('watertank_temperature', result.data.TankWaterTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`watertank_temperature\` has been set (${result.data.TankWaterTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`watertank_temperature\` has not been set (${error})`));

        // Triggers
        const newSettings = this.getSettings();
        if (settings.forced_hot_water !== newSettings.forced_hot_water) {
          this.driver.triggerForcedHotWater(this);
        }
        if (settings.operation_mode_zone !== newSettings.operation_mode_zone) {
          this.driver.triggerOperationModeZone(this);
        }

        if (operationMode !== currentOperationMode) {
          this.driver.triggerOperationMode(this);
        }
      });
    } catch (error) {
      this.error(`\`${this.getName()}\`: ${error}`);
    }

    // Update capabilities from data only available via `ListDevice`
    const deviceList = await this.driver.discoverDevices();
    deviceList.forEach(async (device) => {
      if (device.DeviceID === data.id) {
        await this.setCapabilityValue('booster_heater1', device.Device.BoosterHeater1Status)
          .then(this.log(`\`${this.getName()}\`: capability \`booster_heater1\` has been set (${device.Device.BoosterHeater1Status})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`booster_heater1\` has not been set (${error})`));
        await this.setCapabilityValue('booster_heater2', device.Device.BoosterHeater2Status)
          .then(this.log(`\`${this.getName()}\`: capability \`booster_heater2\` has been set (${device.Device.BoosterHeater2Status})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`booster_heater2\` has not been set (${error})`));
        await this.setCapabilityValue('booster_heater2_plus', device.Device.BoosterHeater2PlusStatus)
          .then(this.log(`\`${this.getName()}\`: capability \`booster_heater2_plus\` has been set (${device.Device.BoosterHeater2PlusStatus})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`booster_heater2_plus\` has not been set (${error})`));
        await this.setCapabilityValue('defrost_mode', Boolean(device.Device.DefrostMode))
          .then(this.log(`\`${this.getName()}\`: capability \`defrost_mode\` has been set (${Boolean(device.Device.DefrostMode)})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`defrost_mode\` has not been set (${error})`));

        const currentFlowTemperature = this.getCapabilityValue('flow_temperature');
        const flowTemperature = device.Device.FlowTemperature;
        await this.setCapabilityValue('flow_temperature', flowTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`flow_temperature\` has been set (${flowTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`flow_temperature\` has not been set (${error})`));

        await this.setCapabilityValue('heat_pump_frequency', device.Device.HeatPumpFrequency)
          .then(this.log(`\`${this.getName()}\`: capability \`heat_pump_frequency\` has been set (${device.Device.HeatPumpFrequency})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`heat_pump_frequency\` has not been set (${error})`));
        await this.setCapabilityValue('immersion_heater', device.Device.ImmersionHeaterStatus)
          .then(this.log(`\`${this.getName()}\`: capability \`immersion_heater\` has been set (${device.Device.ImmersionHeaterStatus})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`immersion_heater\` has not been set (${error})`));

        const currentReturnTemperature = this.getCapabilityValue('return_temperature');
        const returnTemperature = device.Device.ReturnTemperature;
        await this.setCapabilityValue('return_temperature', returnTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`return_temperature\` has been set (${returnTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`return_temperature\` has not been set (${error})`));

        // Triggers
        if (flowTemperature !== currentFlowTemperature) {
          this.driver.triggerFlowTemperature(this);
        }
        if (returnTemperature !== currentReturnTemperature) {
          this.driver.triggerReturnTemperature(this);
        }
      }
    });

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
    this.log(`\`${this.getName()}\`: next sync from device in ${interval} minutes`);
  }

  async syncDeviceFromData() {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const settings = this.getSettings();
    const ContextKey = this.homey.settings.get('ContextKey');
    let options;
    if (data.zone === 2) {
      options = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
        headers: { 'X-MitsContextKey': ContextKey },
        json: {
          DeviceID: data.id,
          EffectiveFlags: 0x1000800010229,
          ForcedHotWaterMode: settings.forced_hot_water,
          HasPendingCommand: true,
          OperationModeZone2: Number(settings.operation_mode_zone),
          Power: this.getCapabilityValue('onoff'),
          SetCoolFlowTemperatureZone2: settings.cool_flow_temperature,
          SetHeatFlowTemperatureZone2: settings.heat_flow_temperature,
          SetTankWaterTemperature: settings.set_watertank_temperature,
          SetTemperatureZone2: this.getCapabilityValue('target_temperature'),
        },
      };
    } else {
      options = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
        headers: { 'X-MitsContextKey': ContextKey },
        json: {
          DeviceID: data.id,
          EffectiveFlags: 0x1000200010029,
          ForcedHotWaterMode: settings.forced_hot_water,
          HasPendingCommand: true,
          OperationModeZone1: Number(settings.operation_mode_zone),
          Power: this.getCapabilityValue('onoff'),
          SetCoolFlowTemperatureZone1: settings.cool_flow_temperature,
          SetHeatFlowTemperatureZone1: settings.heat_flow_temperature,
          SetTankWaterTemperature: settings.set_watertank_temperature,
          SetTemperatureZone1: this.getCapabilityValue('target_temperature'),
        },
      };
    }
    try {
      this.log(`\`${this.getName()}\`: syncing with device`);
      await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        this.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
      });
    } catch (error) {
      this.error(`\`${this.getName()}\`: ${error}`);
    }

    this.syncTimeout = this.homey.setTimeout(this.syncDataFromDevice.bind(this), 60 * 1000);
    this.log(`\`${this.getName()}\`: next sync from device in 1 minute`);
  }

  async onCapabilityOnOff(value) {
    await this.setCapabilityValue('onoff', value)
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` has been set (${value})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityTargetTemperature(value) {
    await this.setCapabilityValue('target_temperature', value)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${value})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  // eslint-disable-next-line no-unused-vars
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (changedKeys.includes('forced_hot_water')) {
      this.driver.triggerForcedHotWater(this);
    }
    if (changedKeys.includes('operation_mode_zone')) {
      this.driver.triggerOperationModeZone(this);
    }
    if (changedKeys.length) {
      await this.syncDeviceFromData();
    }
  }
}

module.exports = MELCloudDeviceAtw;
