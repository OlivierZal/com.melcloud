const http = require('http.min');
const MELCloudDeviceMixin = require('../melclouddevicemixin');

// Operation mode
function operationModeToValue(operationMode) {
  switch (operationMode) {
    case 'off':
      return 0;
    case 'heat':
      return 1;
    case 'dry':
      return 2;
    case 'cool':
      return 3;
    case 'fan':
      return 7;
    case 'auto':
      return 8;
    default:
      return null;
  }
}

function valueToOperationMode(value) {
  switch (value) {
    case 0:
      return 'off';
    case 1:
      return 'heat';
    case 2:
      return 'dry';
    case 3:
      return 'cool';
    case 7:
      return 'fan';
    case 8:
      return 'auto';
    default:
      return null;
  }
}

// Vertical vane direction
function verticalToValue(vertical) {
  switch (vertical) {
    case 'auto':
      return 0;
    case 'top':
      return 1;
    case 'middletop':
      return 2;
    case 'middle':
      return 3;
    case 'middlebottom':
      return 4;
    case 'bottom':
      return 5;
    case 'swing':
      return 7;
    default:
      return null;
  }
}

function valueToVertical(value) {
  switch (value) {
    case 0:
      return 'auto';
    case 1:
      return 'top';
    case 2:
      return 'middletop';
    case 3:
      return 'middle';
    case 4:
      return 'middlebottom';
    case 5:
      return 'bottom';
    case 7:
      return 'swing';
    default:
      return null;
  }
}

// Horizontal vane direction
function horizontalToValue(horizontal) {
  switch (horizontal) {
    case 'auto':
      return 0;
    case 'left':
      return 1;
    case 'middleleft':
      return 2;
    case 'middle':
      return 3;
    case 'middleright':
      return 4;
    case 'right':
      return 5;
    case 'split':
      return 8;
    case 'swing':
      return 12;
    default:
      return null;
  }
}

function valueToHorizontal(value) {
  switch (value) {
    case 0:
      return 'auto';
    case 1:
      return 'left';
    case 2:
      return 'middleleft';
    case 3:
      return 'middle';
    case 4:
      return 'middleright';
    case 5:
      return 'right';
    case 8:
      return 'split';
    case 12:
      return 'swing';
    default:
      return null;
  }
}

class MELCloudAtaDevice extends MELCloudDeviceMixin {
  async onInit() {
    const ataCapabilities = [
      'fan_power',
      'horizontal',
      'measure_power.daily_consumed',
      'measure_power.total_consumed',
      'measure_temperature',
      'onoff',
      'operation_mode',
      'target_temperature',
      'thermostat_mode',
      'vertical',
    ];
    ataCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
      }
    });

    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', this.onCapabilityThermostatMode.bind(this));
    this.registerCapabilityListener('operation_mode', this.onCapabilityOperationMode.bind(this));
    this.registerCapabilityListener('fan_power', this.onCapabilityFanSpeed.bind(this));
    this.registerCapabilityListener('vertical', this.onCapabilityVerticalVaneDirection.bind(this));
    this.registerCapabilityListener('horizontal', this.onCapabilityHorizontalVaneDirection.bind(this));

    await this.syncDataFromDevice();
    await this.fetchEnergyReport();
  }

  async parseEnergyReport(report) {
    Object.entries(report).forEach(async (entry) => {
      const [period, data] = entry;

      const totalConsumed = data.TotalHeatingConsumed
        + data.TotalCoolingConsumed
        + data.TotalAutoConsumed
        + data.TotalDryConsumed
        + data.TotalFanConsumed
        + data.TotalOtherConsumed;
      const deviceCount = data.UsageDisclaimerPercentages
        ? data.UsageDisclaimerPercentages.split(',').length : 1;
      const consumed = Number((totalConsumed / deviceCount).toFixed(0));
      await this.setCapabilityValue(`measure_power.${period}_consumed`, consumed)
        .then(this.log(`\`${this.getName()}\`: capability \`measure_power.${period}_consumed\` equals to \`${consumed}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_power.${period}_consumed\` has not been set (${error})`));
    });
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

        const oldOperationMode = this.getCapabilityValue('operation_mode');
        const operationMode = valueToOperationMode(result.data.OperationMode);
        await this.setThermostatMode(operationMode, result.data.Power);
        if (operationMode !== oldOperationMode) {
          this.driver.triggerOperationMode(this);
        }

        await this.setCapabilityValue('measure_temperature', result.data.RoomTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature\` equals to \`${result.data.RoomTemperature}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature\` has not been set (${error})`));

        await this.setCapabilityValue('target_temperature', result.data.SetTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` equals to \`${result.data.SetTemperature}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));

        const oldFanSpeed = this.getCapabilityValue('fan_power');
        const fanSpeed = result.data.SetFanSpeed;
        await this.setCapabilityValue('fan_power', fanSpeed)
          .then(this.log(`\`${this.getName()}\`: capability \`fan_power\` equals to \`${fanSpeed}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`fan_power\` has not been set (${error})`));
        if (fanSpeed !== oldFanSpeed) {
          this.driver.triggerFanSpeed(this);
        }

        const oldVertical = this.getCapabilityValue('vertical');
        const vertical = valueToVertical(result.data.VaneVertical);
        await this.setCapabilityValue('vertical', vertical)
          .then(this.log(`\`${this.getName()}\`: capability \`vertical\` equals to \`${vertical}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`vertical\` has not been set (${error})`));
        if (vertical !== oldVertical) {
          this.driver.triggerVerticalVaneDirection(this);
        }

        const oldHorizontal = this.getCapabilityValue('horizontal');
        const horizontal = valueToHorizontal(result.data.VaneHorizontal);
        await this.setCapabilityValue('horizontal', horizontal)
          .then(this.log(`\`${this.getName()}\`: capability \`horizontal\` equals to \`${horizontal}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`horizontal\` has not been set (${error})`));
        if (horizontal !== oldHorizontal) {
          this.driver.triggerHorizontalVaneDirection(this);
        }
      });

      const interval = this.getSetting('interval');
      this.syncTimeout = this.homey
        .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
      this.log(`\`${this.getName()}\`: sync from device has been successfully completed, next one in ${interval} minutes`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found while syncing from device`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing from device (${error})`);
      }
    }
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

      this.syncTimeout = this.homey.setTimeout(this.syncDataFromDevice.bind(this), 60 * 1000);
      this.log(`\`${this.getName()}\`: sync with device has been successfully completed, sync from device in 1 minute`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found while syncing with device`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing with device (${error})`);
      }
    }
  }

  async onCapabilityOnOff(isOn) {
    await this.setThermostatMode(this.getCapabilityValue('operation_mode'), isOn);
    await this.syncDeviceFromData();
  }

  async onCapabilityTargetTemperature(targetTemperature) {
    await this.setCapabilityValue('target_temperature', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityThermostatMode(thermostatMode) {
    await this.setOperationMode(thermostatMode);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationMode(operationMode) {
    await this.setThermostatMode(operationMode, this.getCapabilityValue('onoff'));
    this.driver.triggerOperationMode(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityFanSpeed(fanSpeed) {
    await this.setCapabilityValue('fan_power', fanSpeed)
      .then(this.log(`\`${this.getName()}\`: capability \`fan_power\` equals to \`${fanSpeed}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`fan_power\` has not been set (${error})`));
    this.driver.triggerFanSpeed(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityVerticalVaneDirection(vertical) {
    await this.setCapabilityValue('vertical', vertical)
      .then(this.log(`\`${this.getName()}\`: capability \`vertical\` equals to \`${vertical}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`vertical\` has not been set (${error})`));
    this.driver.triggerVerticalVaneDirection(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityHorizontalVaneDirection(horizontal) {
    await this.setCapabilityValue('horizontal', horizontal)
      .then(this.log(`\`${this.getName()}\`: capability \`horizontal\` equals to \`${horizontal}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`horizontal\` has not been set (${error})`));
    this.driver.triggerHorizontalVaneDirection(this);
    await this.syncDeviceFromData();
  }

  async setThermostatMode(operationMode, isOn) {
    await this.setCapabilityValue('onoff', operationMode !== 'off' && isOn)
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` equals to \`false\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));

    await this.setCapabilityValue('operation_mode', operationMode)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode\` equals to \`${operationMode}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode\` has not been set (${error})`));

    if (operationMode !== 'dry' && operationMode !== 'fan') {
      await this.setCapabilityValue('thermostat_mode', isOn ? operationMode : 'off')
        .then(this.log(`\`${this.getName()}\`: capability \`thermostat_mode\` equals to \`${isOn ? operationMode : 'off'}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`thermostat_mode\` has not been set (${error})`));
    }
  }

  async setOperationMode(thermostatMode) {
    await this.setCapabilityValue('onoff', thermostatMode !== 'off')
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` equals to \`${thermostatMode === 'off'}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));

    if (thermostatMode !== 'off') {
      await this.setCapabilityValue('operation_mode', thermostatMode)
        .then(this.log(`\`${this.getName()}\`: capability \`operation_mode\` equals to \`${thermostatMode}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode\` has not been set (${error})`));
    }

    await this.setCapabilityValue('thermostat_mode', thermostatMode)
      .then(this.log(`\`${this.getName()}\`: capability \`thermostat_mode\` equals to \`${thermostatMode}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`thermostat_mode\` has not been set (${error})`));
  }
}

module.exports = MELCloudAtaDevice;
