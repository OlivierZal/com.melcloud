const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

// Operation mode
function operationModeToValue(operationMode) {
  let value;
  if (operationMode === 'off') {
    value = 0;
  } else if (operationMode === 'heat') {
    value = 1;
  } else if (operationMode === 'dry') {
    value = 2;
  } else if (operationMode === 'cool') {
    value = 3;
  } else if (operationMode === 'fan') {
    value = 7;
  } else if (operationMode === 'auto') {
    value = 8;
  }
  return value;
}

function valueToOperationMode(value) {
  let operationMode;
  if (value === 0) {
    operationMode = 'off';
  } else if (value === 1) {
    operationMode = 'heat';
  } else if (value === 2) {
    operationMode = 'dry';
  } else if (value === 3) {
    operationMode = 'cool';
  } else if (value === 7) {
    operationMode = 'fan';
  } else if (value === 8) {
    operationMode = 'auto';
  }
  return operationMode;
}

// Horizontal vane direction
function horizontalToValue(horizontal) {
  let value;
  if (horizontal === 'auto') {
    value = 0;
  } else if (horizontal === 'left') {
    value = 1;
  } else if (horizontal === 'middleleft') {
    value = 2;
  } else if (horizontal === 'middle') {
    value = 3;
  } else if (horizontal === 'middleright') {
    value = 4;
  } else if (horizontal === 'right') {
    value = 5;
  } else if (horizontal === 'split') {
    value = 8;
  } else if (horizontal === 'swing') {
    value = 12;
  }
  return value;
}

function valueToHorizontal(value) {
  let horizontal;
  if (value === 0) {
    horizontal = 'auto';
  } else if (value === 1) {
    horizontal = 'left';
  } else if (value === 2) {
    horizontal = 'middleleft';
  } else if (value === 3) {
    horizontal = 'middle';
  } else if (value === 4) {
    horizontal = 'middleright';
  } else if (value === 5) {
    horizontal = 'right';
  } else if (value === 8) {
    horizontal = 'split';
  } else if (value === 12) {
    horizontal = 'swing';
  }
  return horizontal;
}

// Vertical vane direction
function verticalToValue(vertical) {
  let value;
  if (vertical === 'auto') {
    value = 0;
  } else if (vertical === 'top') {
    value = 1;
  } else if (vertical === 'middletop') {
    value = 2;
  } else if (vertical === 'middle') {
    value = 3;
  } else if (vertical === 'middlebottom') {
    value = 4;
  } else if (vertical === 'bottom') {
    value = 5;
  } else if (vertical === 'swing') {
    value = 7;
  }
  return value;
}

function valueToVertical(value) {
  let vertical;
  if (value === 0) {
    vertical = 'auto';
  } else if (value === 1) {
    vertical = 'top';
  } else if (value === 2) {
    vertical = 'middletop';
  } else if (value === 3) {
    vertical = 'middle';
  } else if (value === 4) {
    vertical = 'middlebottom';
  } else if (value === 5) {
    vertical = 'bottom';
  } else if (value === 7) {
    vertical = 'swing';
  }
  return vertical;
}

class MELCloudDeviceAta extends Homey.Device {
  async migrateCapabilities() {
    const addedCapabilities = [
      'operation_mode',
    ];
    const removedCapabilities = [
      'mode_capability',
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

    this.registerCapabilityListener('fan_power', this.onCapabilityFanSpeed.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', this.onCapabilityThermostatMode.bind(this));
    this.registerCapabilityListener('horizontal', this.onCapabilityHorizontalVaneDirection.bind(this));
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('operation_mode', this.onCapabilityOperationMode.bind(this));
    this.registerCapabilityListener('vertical', this.onCapabilityVerticalVaneDirection.bind(this));
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
      this.log(`\`${this.getName()}\`: syncing from device...`);
      await http.get(options).then(async (result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        this.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }

        // Room temperature
        await this.setCapabilityValue('measure_temperature', result.data.RoomTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature\` has been set (${result.data.RoomTemperature})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature\` has not been set (${error})`));

        // Fan speed
        const oldFanSpeed = this.getCapabilityValue('fan_power');
        const fanSpeed = result.data.SetFanSpeed;
        await this.setCapabilityValue('fan_power', fanSpeed)
          .then(this.log(`\`${this.getName()}\`: capability \`fan_power\` has been set (${fanSpeed})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`fan_power\` has not been set (${error})`));
        if (fanSpeed !== oldFanSpeed) {
          this.driver.triggerFanSpeed(this);
        }

        // Horizontal vane direction
        const oldHorizontal = this.getCapabilityValue('horizontal');
        const horizontal = valueToHorizontal(result.data.VaneHorizontal);
        await this.setCapabilityValue('horizontal', horizontal)
          .then(this.log(`\`${this.getName()}\`: capability \`horizontal\` has been set (${horizontal})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`horizontal\` has not been set (${error})`));
        if (horizontal !== oldHorizontal) {
          this.driver.triggerHorizontalVaneDirection(this);
        }

        // On/Off && Operation mode
        const oldOperationMode = this.getCapabilityValue('operation_mode');
        const operationMode = valueToOperationMode(result.data.OperationMode);
        await this.setThermostatMode(operationMode, result.data.Power);
        if (operationMode !== oldOperationMode) {
          this.driver.triggerOperationMode(this);
        }

        // Target temperature
        const minSetTemperature = 4;
        const maxSetTemperature = 35;
        if (result.data.SetTemperature < 4) {
          await this.setCapabilityValue('target_temperature', minSetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${minSetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        } else if (result.data.SetTemperature > 35) {
          await this.setCapabilityValue('target_temperature', maxSetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${maxSetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        } else {
          await this.setCapabilityValue('target_temperature', result.data.SetTemperature)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${result.data.SetTemperature})`))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
        }

        // Vertical vane direction
        const oldVertical = this.getCapabilityValue('vertical');
        const vertical = valueToVertical(result.data.VaneVertical);
        await this.setCapabilityValue('vertical', vertical)
          .then(this.log(`\`${this.getName()}\`: capability \`vertical\` has been set (${vertical})`))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`vertical\` has not been set (${error})`));
        if (vertical !== oldVertical) {
          this.driver.triggerVerticalVaneDirection(this);
        }
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing from device (${error})`);
      }
    }

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
    this.log(`\`${this.getName()}\`: next sync from device in ${interval} minutes`);
  }

  async syncDeviceFromData() {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const options = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta',
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: {
        DeviceID: data.id,
        EffectiveFlags: 0x11f,
        HasPendingCommand: true,
        OperationMode: operationModeToValue(this.getCapabilityValue('operation_mode')),
        Power: this.getCapabilityValue('onoff'),
        SetFanSpeed: this.getCapabilityValue('fan_power'),
        SetTemperature: this.getCapabilityValue('target_temperature'),
        VaneHorizontal: horizontalToValue(this.getCapabilityValue('horizontal')),
        VaneVertical: verticalToValue(this.getCapabilityValue('vertical')),
      },
    };
    try {
      this.log(`\`${this.getName()}\`: syncing with device...`);
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
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing with device (${error})`);
      }
    }

    this.syncTimeout = this.homey.setTimeout(this.syncDataFromDevice.bind(this), 60 * 1000);
    this.log(`\`${this.getName()}\`: next sync from device in 1 minute`);
  }

  async onCapabilityFanSpeed(fanSpeed) {
    await this.setCapabilityValue('fan_power', fanSpeed)
      .then(this.log(`\`${this.getName()}\`: capability \`fan_power\` has been set (${fanSpeed})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`fan_power\` has not been set (${error})`));
    this.driver.triggerFanSpeed(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityHorizontalVaneDirection(horizontal) {
    await this.setCapabilityValue('horizontal', horizontal)
      .then(this.log(`\`${this.getName()}\`: capability \`horizontal\` has been set (${horizontal})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`horizontal\` has not been set (${error})`));
    this.driver.triggerHorizontalVaneDirection(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityOnOff(onOff) {
    await this.setThermostatMode(this.getCapabilityValue('operation_mode'), onOff);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationMode(operationMode) {
    await this.setThermostatMode(operationMode, this.getCapabilityValue('onoff'));
    this.driver.triggerOperationMode(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityTargetTemperature(targetTemperature) {
    await this.setCapabilityValue('target_temperature', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` has been set (${targetTemperature})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityThermostatMode(thermostatMode) {
    await this.setOperationMode(thermostatMode);
    await this.syncDeviceFromData();
  }

  async onCapabilityVerticalVaneDirection(vertical) {
    await this.setCapabilityValue('vertical', vertical)
      .then(this.log(`\`${this.getName()}\`: capability \`vertical\` has been set (${vertical})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`vertical\` has not been set (${error})`));
    this.driver.triggerVerticalVaneDirection(this);
    await this.syncDeviceFromData();
  }

  // Sync `OnOff`, `OperationMode` and `ThermostatMode` from `OperationMode` and `OnOff`
  async setThermostatMode(operationMode, onOff) {
    await this.setCapabilityValue('onoff', operationMode !== 'off' && onOff)
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` has been set (false)`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));

    await this.setCapabilityValue('operation_mode', operationMode)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode\` has been set (${operationMode})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode\` has not been set (${error})`));

    if (operationMode !== 'dry' && operationMode !== 'fan') {
      await this.setCapabilityValue('thermostat_mode', onOff ? operationMode : 'off')
        .then(this.log(`\`${this.getName()}\`: capability \`thermostat_mode\` has been set (${onOff ? operationMode : 'off'})`))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`thermostat_mode\` has not been set (${error})`));
    }
  }

  // Sync `OnOff`, `OperationMode` and `ThermostatMode` from `ThermostatMode`
  async setOperationMode(thermostatMode) {
    await this.setCapabilityValue('onoff', thermostatMode !== 'off')
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` has been set (${thermostatMode === 'off'})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));

    if (thermostatMode !== 'off') {
      await this.setCapabilityValue('operation_mode', thermostatMode)
        .then(this.log(`\`${this.getName()}\`: capability \`operation_mode\` has been set (${thermostatMode})`))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode\` has not been set (${error})`));
    }

    await this.setCapabilityValue('thermostat_mode', thermostatMode)
      .then(this.log(`\`${this.getName()}\`: capability \`thermostat_mode\` has been set (${thermostatMode})`))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`thermostat_mode\` has not been set (${error})`));
  }
}

module.exports = MELCloudDeviceAta;
