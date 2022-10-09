const Homey = require('homey'); // eslint-disable-line import/no-unresolved

function operationModeToDevice(value) {
  switch (value) {
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
      throw new Error(`Capability \`operation_mode\`: invalid value \`${value}\``);
  }
}

function operationModeFromDevice(value) {
  switch (value) {
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
      throw new Error(`MELCloud \`OperationMode\`: invalid value \`${value}\``);
  }
}

function verticalToDevice(value) {
  switch (value) {
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
      throw new Error(`Capability \`vertical\`: invalid value \`${value}\``);
  }
}

function verticalFromDevice(value) {
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
      throw new Error(`MELCLoud \`VaneVertical\`: invalid value \`${value}\``);
  }
}

function horizontalToDevice(value) {
  switch (value) {
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
      throw new Error(`Capability \`horizontal\`: invalid value \`${value}\``);
  }
}

function horizontalFromDevice(value) {
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
      throw new Error(`MELCloud \`VaneHorizontal\`: invalid value \`${value}\``);
  }
}

class MELCloudAtaDevice extends Homey.Device {
  cleanCapabilities() {
    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;
    currentCapabilities.forEach((capability) => {
      if (!requiredCapabilities.includes(capability)) {
        this.removeCapability(capability);
      }
    });
    requiredCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
      }
    });
  }

  async onInit() {
    await this.setWarning(null);
    this.cleanCapabilities();

    this.registerCapabilityListener('onoff', await this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', await this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', await this.onCapabilityThermostatMode.bind(this));
    this.registerCapabilityListener('operation_mode', await this.onCapabilityOperationMode.bind(this));
    this.registerCapabilityListener('fan_power', await this.onCapabilityFanSpeed.bind(this));
    this.registerCapabilityListener('vertical', await this.onCapabilityVaneVertical.bind(this));
    this.registerCapabilityListener('horizontal', await this.onCapabilityVaneHorizontal.bind(this));

    await this.syncDataFromDevice();
    await this.parseEnergyReports();
  }

  async parseEnergyReports() {
    this.homey.clearTimeout(this.reportTimeout);

    const reportData = {};
    reportData.daily = await this.homey.app.fetchEnergyReport(this, true);
    reportData.total = await this.homey.app.fetchEnergyReport(this, false);
    Object.entries(reportData).forEach((entry) => {
      const [period, data] = entry;
      const reportMapping = {};

      const deviceCount = data.UsageDisclaimerPercentages
        ? data.UsageDisclaimerPercentages.split(', ').length : 1;
      reportMapping[`measure_power.${period}_consumed`] = 0;
      ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'].forEach((mode) => {
        reportMapping[`measure_power.${period}_consumed_${mode.toLowerCase()}`] = data[`Total${mode}Consumed`] / deviceCount;
        reportMapping[`measure_power.${period}_consumed`] += reportMapping[`measure_power.${period}_consumed_${mode.toLowerCase()}`];
      });
      Object.entries(reportMapping).forEach(async (total) => {
        const [capability, value] = total;
        await this.setOrNotCapabilityValue(capability, value);
      });
    });

    this.reportTimeout = this.homey
      .setTimeout(this.syncDataFromDevice.bind(this), 24 * 60 * 60 * 1000);
    this.log(`\`${this.getName()}\`: energy reports have been processed`);
  }

  async syncDataFromDevice() {
    this.homey.clearTimeout(this.syncTimeout);

    const resultData = await this.homey.app.getDevice(this);

    this.updateCapabilities(resultData);
  }

  async syncDeviceFromData(updateJson) {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const json = {
      DeviceID: data.id,
      EffectiveFlags: 0,
      HasPendingCommand: true,
      Power: this.getCapabilityValue('onoff'),
      SetTemperature: this.getCapabilityValue('target_temperature'),
      OperationMode: operationModeToDevice(this.getCapabilityValue('operation_mode')),
      SetFanSpeed: this.getCapabilityValue('fan_power'),
      VaneVertical: verticalToDevice(this.getCapabilityValue('vertical')),
      VaneHorizontal: horizontalToDevice(this.getCapabilityValue('horizontal')),
    };
    Object.entries(updateJson).forEach((entry) => {
      const [key, value] = entry;
      json[key] = value;
    });
    const resultData = await this.homey.app.setDevice(this, json);

    this.updateCapabilities(resultData);
  }

  async updateCapabilities(resultData) {
    const isOn = resultData.Power;
    const operationMode = operationModeFromDevice(resultData.OperationMode);

    await this.setOrNotCapabilityValue('onoff', isOn);
    await this.setOrNotCapabilityValue('measure_temperature', resultData.RoomTemperature);
    await this.setOrNotCapabilityValue('target_temperature', resultData.SetTemperature);
    await this.setOrNotCapabilityValue('operation_mode', operationMode);
    await this.setOrNotCapabilityValue('fan_power', resultData.SetFanSpeed);
    await this.setOrNotCapabilityValue('vertical', verticalFromDevice(resultData.VaneVertical));
    await this.setOrNotCapabilityValue('horizontal', horizontalFromDevice(resultData.VaneHorizontal));
    await this.updateThermostatMode(operationMode, isOn);

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
    this.log(`\`${this.getName()}\`: sync from device has been completed, sync from device in ${interval} minutes`);
  }

  async updateThermostatMode(operationMode, isOn) {
    if (!['dry', 'fan'].includes(operationMode)) {
      await this.setOrNotCapabilityValue('thermostat_mode', isOn ? operationMode : 'off');
    } else {
      await this.setOrNotCapabilityValue('thermostat_mode', 'off');
    }
  }

  async onCapabilityOnoff(value) {
    const updateJson = {
      EffectiveFlags: 0x1,
      Power: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityTargetTemperature(value) {
    let targetTemperature = value;
    if (['auto', 'cool', 'dry'].includes(this.getCapabilityValue('operation_mode')) && value < 16) {
      targetTemperature = 16;
    }
    const updateJson = {
      EffectiveFlags: 0x4,
      SetTemperature: targetTemperature,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityThermostatMode(value) {
    const updateJson = {
      EffectiveFlags: 0,
    };
    if ((value !== 'off') !== this.getCapabilityValue('onoff')) {
      updateJson.EffectiveFlags |= 0x1; // eslint-disable-line no-bitwise
      updateJson.Power = value !== 'off';
    }
    if (value !== 'off') {
      updateJson.EffectiveFlags |= 0x2; // eslint-disable-line no-bitwise
      updateJson.OperationMode = operationModeToDevice(value);
    }
    if (updateJson.EffectiveFlags) {
      await this.syncDeviceFromData(updateJson);
    }
  }

  async onCapabilityOperationMode(value) {
    await this.setWarning(null);
    if (['dry', 'fan'].includes(value) && this.getCapabilityValue('thermostat_mode') !== 'off') {
      await this.setWarning(`\`${value}\` has well been registered (even if \`heat\` is displayed)`);
    }
    const updateJson = {
      EffectiveFlags: 0x2,
      OperationMode: operationModeToDevice(value),
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityFanSpeed(value) {
    const updateJson = {
      EffectiveFlags: 0x8,
      SetFanSpeed: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityVaneVertical(value) {
    const updateJson = {
      EffectiveFlags: 0x10,
      VaneVertical: verticalToDevice(value),
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityVaneHorizontal(value) {
    const updateJson = {
      EffectiveFlags: 0x100,
      VaneHorizontal: horizontalToDevice(value),
    };
    await this.syncDeviceFromData(updateJson);
  }

  async setOrNotCapabilityValue(capability, value) {
    if (value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(`\`${this.getName()}\`: capability \`${capability}\` is \`${value}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`${capability}\` has not been set to \`${value}\` (${error})`));
    }
  }
}

module.exports = MELCloudAtaDevice;
