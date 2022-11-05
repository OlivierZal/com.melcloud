const MELCloudDeviceMixin = require('../../mixins/device_mixin');

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

class MELCloudAtaDevice extends MELCloudDeviceMixin {
  async handleCapabilities() {
    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
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
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
  }

  registerCapabilityListeners() {
    this.registerCapabilityListener('onoff', async (value) => { await this.onCapability('onoff', value); });
    this.registerCapabilityListener('target_temperature', async (value) => { await this.onCapability('target_temperature', value); });
    this.registerCapabilityListener('thermostat_mode', async (value) => { await this.onCapability('thermostat_mode', value); });
    this.registerCapabilityListener('operation_mode', async (value) => { await this.onCapability('operation_mode', value); });
    this.registerCapabilityListener('fan_power', async (value) => { await this.onCapability('fan_power', value); });
    this.registerCapabilityListener('vertical', async (value) => { await this.onCapability('vertical', value); });
    this.registerCapabilityListener('horizontal', async (value) => { await this.onCapability('horizontal', value); });
  }

  async runEnergyReports() {
    const reportMapping = {};
    const report = {};
    report.daily = await this.homey.app.reportEnergyCost(this, true);
    report.total = await this.homey.app.reportEnergyCost(this, false);
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

    this.log(this.getName(), '- Energy reports have been processed');
  }

  async endSyncData() {
    await this.updateThermostatMode(this.getCapabilityValue('onoff'), this.getCapabilityValue('operation_mode'));

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(() => { this.syncDataFromDevice(); }, interval * 60 * 1000);
    this.log(this.getName(), '- Next sync from device in', interval, 'minutes');
  }

  async updateThermostatMode(isOn, operationMode) {
    let value = operationMode;
    if (!isOn || ['dry', 'fan'].includes(operationMode)) {
      value = 'off';
    }
    await this.setOrNotCapabilityValue('thermostat_mode', value);
  }

  async onCapability(capability, value) {
    this.homey.clearTimeout(this.syncTimeout);

    switch (capability) {
      case 'thermostat_mode':
        this.updateJson.onoff = this.getCapabilityValueToDevice('onoff', value !== 'off');
        if (value !== 'off') {
          this.updateJson.operation_mode = this.getCapabilityValueToDevice('operation_mode', value);
        }
        break;
      case 'operation_mode':
        if (['dry', 'fan'].includes(value) && this.getCapabilityValue('thermostat_mode') !== 'off') {
          await this.setWarning(`\`${value}\` has been saved (even if \`heat\` is displayed)`);
          await this.setWarning(null);
        }
        this.updateJson[capability] = this.getCapabilityValueToDevice(capability, value);
        break;
      default:
        this.updateJson[capability] = this.getCapabilityValueToDevice(capability, value);
    }

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.syncDataToDevice(this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  getCapabilityValueToDevice(capability, value) {
    const newValue = value ?? this.getCapabilityValue(capability);
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
      this.error(this.getName(), '-', capability, 'cannot be set from', error.message);
    }
  }
}

module.exports = MELCloudAtaDevice;
