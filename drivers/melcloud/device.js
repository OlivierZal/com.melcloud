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
      return null;
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
      throw new Error(value);
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
      return null;
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
      throw new Error(value);
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
      return null;
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
      throw new Error(value);
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
    await this.setWarning('Your app has been optimized! You may need to recreate some flow cards');

    await this.handleCapabilities();

    this.registerCapabilityListener('onoff', await this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('target_temperature', await this.onCapabilityTargetTemperature.bind(this));
    this.registerCapabilityListener('thermostat_mode', await this.onCapabilityThermostatMode.bind(this));
    this.registerCapabilityListener('operation_mode', await this.onCapabilityOperationMode.bind(this));
    this.registerCapabilityListener('fan_power', await this.onCapabilityFanSpeed.bind(this));
    this.registerCapabilityListener('vertical', await this.onCapabilityVaneVertical.bind(this));
    this.registerCapabilityListener('horizontal', await this.onCapabilityVaneHorizontal.bind(this));

    await this.homey.app.syncDataFromDevice(this);
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
        await this.setCapabilityValueFromDevice(capability, reportMapping[capability]);
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

    this.reportTimeout = this.homey
      .setTimeout(this.runEnergyReports.bind(this), 24 * 60 * 60 * 1000);
    this.log(`\`${this.getName()}\`: energy reports have been processed`);
  }

  async endSyncData() {
    await this.updateThermostatMode(this.getCapabilityValue('onoff'), this.getCapabilityValue('operation_mode'));

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(() => { this.homey.app.syncDataFromDevice(this); }, interval * 60 * 1000);
    this.log(`\`${this.getName()}\`: sync from device has been completed, sync from device in ${interval} minutes`);
  }

  async updateThermostatMode(isOn, operationMode) {
    let value = 'off';
    if (isOn && !['dry', 'fan'].includes(operationMode)) {
      value = operationMode;
    }
    await this.setOrNotCapabilityValue('thermostat_mode', value);
  }

  async onCapabilityOnoff(value) {
    await this.homey.app.syncDataToDevice(this, { onoff: value });
  }

  async onCapabilityTargetTemperature(value) {
    await this.homey.app.syncDataToDevice(this, { target_temperature: value });
  }

  async onCapabilityThermostatMode(value) {
    const updateJson = {};
    if ((value !== 'off') !== this.getCapabilityValue('onoff')) {
      updateJson.onoff = value !== 'off';
    }
    if (value !== 'off') {
      updateJson.operation_mode = value;
    }
    if (updateJson) {
      await this.homey.app.syncDataToDevice(this, updateJson);
    }
  }

  async onCapabilityOperationMode(value) {
    if (['dry', 'fan'].includes(value) && this.getCapabilityValue('thermostat_mode') !== 'off') {
      await this.setWarning(`\`${value}\` has been saved (even if \`heat\` is displayed)`);
      await this.setWarning(null);
    }
    await this.homey.app.syncDataToDevice(this, { operation_mode: value });
  }

  async onCapabilityFanSpeed(value) {
    await this.homey.app.syncDataToDevice(this, { fan_power: value });
  }

  async onCapabilityVaneVertical(value) {
    await this.homey.app.syncDataToDevice(this, { vertical: value });
  }

  async onCapabilityVaneHorizontal(value) {
    await this.homey.app.syncDataToDevice(this, { horizontal: value });
  }

  getCapabilityValueToDevice(capability, value) {
    let newValue = value;
    if (newValue === undefined) {
      newValue = this.getCapabilityValue(capability);
    }
    switch (capability) {
      case 'operation_mode':
        return operationModeToDevice(newValue);
      case 'vertical':
        return verticalToDevice(newValue);
      case 'horizontal':
        return horizontalToDevice(newValue);
      default:
        return newValue;
    }
  }

  async setCapabilityValueFromDevice(capability, value) {
    try {
      let newValue = value;
      switch (capability) {
        case 'operation_mode':
          newValue = operationModeFromDevice(newValue);
          break;
        case 'vertical':
          newValue = verticalFromDevice(newValue);
          break;
        case 'horizontal':
          newValue = horizontalFromDevice(newValue);
          break;
        default:
      }
      await this.setOrNotCapabilityValue(capability, newValue);
    } catch (error) {
      this.error(`\`${this.getName()}\`: capability \`${capability}\` cannot be set from \`${error.message}\``);
    }
  }

  async setOrNotCapabilityValue(capability, value) {
    if (value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(`\`${this.getName()}\`: capability \`${capability}\` is \`${value}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: ${error.message}`));
    }
  }

  async onSettings(event) {
    if (event.changedKeys.includes('interval')) {
      this.syncTimeout = this.homey
        .setTimeout(() => { this.homey.app.syncDataFromDevice(this); }, 5 * 1000);
    }
  }

  onDeleted() {
    this.homey.clearTimeout(this.reportTimeout);
    this.homey.clearTimeout(this.syncTimeout);
  }
}

module.exports = MELCloudAtaDevice;
