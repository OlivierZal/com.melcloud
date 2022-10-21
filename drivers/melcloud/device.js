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
    default:
      return 8;
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
    default:
      return 'auto';
  }
}

function verticalToDevice(value) {
  switch (value) {
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
    case 'auto':
    default:
      return 0;
  }
}

function verticalFromDevice(value) {
  switch (value) {
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
    case 0:
    default:
      return 'auto';
  }
}

function horizontalToDevice(value) {
  switch (value) {
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
    case 'auto':
    default:
      return 0;
  }
}

function horizontalFromDevice(value) {
  switch (value) {
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
    case 0:
    default:
      return 'auto';
  }
}

class MELCloudAtaDevice extends Homey.Device {
  /* eslint-disable no-await-in-loop, no-restricted-syntax */
  async handleCapabilities() {
    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;
    for (const capability of currentCapabilities) {
      if (!requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability);
      }
    }
    for (const capability of requiredCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability);
      }
    }
  }
  /* eslint-enable no-await-in-loop, no-restricted-syntax */

  async onInit() {
    await this.setWarning(null);

    await this.handleCapabilities();

    this.registerCapabilityListener('onoff', await this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', await this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', await this.onCapabilityThermostatMode.bind(this));
    this.registerCapabilityListener('operation_mode', await this.onCapabilityOperationMode.bind(this));
    this.registerCapabilityListener('fan_power', await this.onCapabilityFanSpeed.bind(this));
    this.registerCapabilityListener('vertical', await this.onCapabilityVaneVertical.bind(this));
    this.registerCapabilityListener('horizontal', await this.onCapabilityVaneHorizontal.bind(this));

    await this.syncDataFromDevice();
    await this.runEnergyReports();
  }

  async runEnergyReports() {
    this.homey.clearTimeout(this.reportTimeout);

    const reportMapping = {};
    const report = {};
    report.daily = await this.homey.app.fetchEnergyReport(this, true);
    report.total = await this.homey.app.fetchEnergyReport(this, false);
    Object.entries(report).forEach((entry) => {
      const [period, data] = entry;
      const deviceCount = data.UsageDisclaimerPercentages
        ? data.UsageDisclaimerPercentages.split(', ').length : 1;
      reportMapping[`meter_power.${period}_consumed`] = 0;
      ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'].forEach((mode) => {
        reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}`] = data[`Total${mode}Consumed`] / deviceCount;
        reportMapping[`meter_power.${period}_consumed`] += reportMapping[`meter_power.${period}_consumed_${mode.toLowerCase()}`];
      });
    });

    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const capability in reportMapping) {
      if (Object.prototype.hasOwnProperty.call(reportMapping, capability)) {
        await this.setOrNotCapabilityValue(capability, reportMapping[capability]);
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

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
    if (['dry', 'fan'].includes(value) && this.getCapabilityValue('thermostat_mode') !== 'off') {
      await this.setWarning(`\`${value}\` has been saved (even if \`heat\` is displayed)`);
      await this.setWarning(null);
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
