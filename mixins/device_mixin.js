const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDeviceMixin extends Homey.Device {
  async onInit() {
    await this.handleCapabilities();
    await this.handleDashboardCapabilities();

    this.data = this.getData();
    this.uid = `${this.data.buildingid}-${this.data.id}`;
    this.updateJson = {};
    this.registerCapabilityListeners();

    await this.syncDataFromDevice();
    await this.runEnergyReports();
    this.reportTimeout = this.homey.setTimeout(() => {
      this.runEnergyReports();
      this.reportInterval = this.homey.setInterval(() => {
        this.runEnergyReports();
      }, 24 * 60 * 60 * 1000);
    }, new Date().setHours(24, 0, 0, 0) - new Date().getTime());
  }

  async onSettings(event) {
    await this.handleDashboardCapabilities(event.newSettings, event.changedKeys);

    let hasReported = false;
    let hasSynced = false;
    let needsSync = false;
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const setting of event.changedKeys) {
      if (!['always_on', 'interval'].includes(setting)) {
        await this.setWarning('Exit device and return to refresh your dashboard');
      }
      if (setting.startsWith('meter_power')) {
        if (!hasReported) {
          await this.runEnergyReports();
          hasReported = true;
        }
      } else if (!hasSynced) {
        if (!needsSync) {
          needsSync = true;
        }
        if (setting === 'always_on' && event.newSettings.always_on) {
          await this.onCapability('onoff', true);
          hasSynced = true;
          needsSync = false;
        }
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
    await this.setWarning(null);

    if (needsSync) {
      this.homey.clearTimeout(this.syncTimeout);
      this.syncTimeout = this.homey
        .setTimeout(() => { this.syncDataFromDevice(); }, 1 * 1000);
    }
  }

  onDeleted() {
    this.homey.clearInterval(this.reportInterval);
    this.homey.clearTimeout(this.reportTimeout);
    this.homey.clearTimeout(this.syncTimeout);
  }

  async handleDashboardCapabilities(settings, capabilities) {
    const newSettings = settings ?? this.getSettings();
    let newCapabilities = capabilities ?? Object.keys(newSettings);
    newCapabilities = newCapabilities
      .filter((capability) => this.driver.manifest.capabilities.includes(capability))
      .filter((capability) => Object.keys(newSettings).includes(capability));
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const capability of newCapabilities) {
      if (newSettings[capability] && !this.hasCapability(capability)) {
        await this.addCapability(capability);
      } else if (!newSettings[capability] && this.hasCapability(capability)) {
        await this.removeCapability(capability);
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
  }

  async getDeviceFromListDevices() {
    const listDevices = await this.homey.app.listDevices(this);
    const deviceFromListDevices = listDevices[this.uid];
    if (!deviceFromListDevices) {
      this.instanceError('Not found while searching from device list');
    }
    return deviceFromListDevices;
  }

  async syncDataFromDevice() {
    const resultData = await this.homey.app.getDevice(this);
    await this.syncData(resultData);
  }

  async syncDataToDevice(updateJson) {
    const json = {
      DeviceID: this.data.id,
      HasPendingCommand: true,
    };
    let effectiveFlags = BigInt(0);
    Object.entries(this.driver.setCapabilityMapping).forEach((entry) => {
      const [capability, values] = entry;
      if (this.hasCapability(capability)) {
        const { tag, effectiveFlag } = values;
        if (capability in updateJson) {
          // eslint-disable-next-line no-bitwise
          effectiveFlags |= effectiveFlag;
          json[tag] = updateJson[capability];
        } else {
          json[tag] = this.getCapabilityValueToDevice(capability);
        }
      }
    });
    json.EffectiveFlags = Number(effectiveFlags);

    const resultData = await this.homey.app.setDevice(this, json);
    await this.syncData(resultData);
  }

  async syncData(resultData) {
    await this.updateCapabilities(resultData);

    const deviceFromListDevices = await this.getDeviceFromListDevices();
    await this.updateListCapabilities(deviceFromListDevices);

    await this.customSyncData(deviceFromListDevices);

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(() => { this.syncDataFromDevice(); }, interval * 60 * 1000);
    this.instanceLog('Next sync from device in', interval, 'minutes');
  }

  async updateCapabilities(resultData) {
    if (resultData) {
      /* eslint-disable guard-for-in, no-await-in-loop, no-restricted-syntax */
      for (const capability in this.driver.setCapabilityMapping) {
        const { effectiveFlag } = this.driver.setCapabilityMapping[capability];
        // eslint-disable-next-line no-bitwise
        if (resultData.EffectiveFlags === 0 || BigInt(resultData.EffectiveFlags) & effectiveFlag) {
          const { tag } = this.driver.setCapabilityMapping[capability];
          await this.setCapabilityValueFromDevice(capability, resultData[tag]);
        }
      }
      /* eslint-enable guard-for-in, no-await-in-loop, no-restricted-syntax */

      /* eslint-disable guard-for-in, no-await-in-loop, no-restricted-syntax */
      for (const capability in this.driver.getCapabilityMapping) {
        const { tag } = this.driver.getCapabilityMapping[capability];
        await this.setCapabilityValueFromDevice(capability, resultData[tag]);
      }
      /* eslint-enable guard-for-in, no-await-in-loop, no-restricted-syntax */
    }
  }

  async updateListCapabilities(deviceFromListDevices) {
    if (deviceFromListDevices) {
      /* eslint-disable guard-for-in, no-await-in-loop, no-restricted-syntax */
      for (const capability in this.driver.listCapabilityMapping) {
        const { tag } = this.driver.listCapabilityMapping[capability];
        await this.setCapabilityValueFromDevice(capability, deviceFromListDevices.Device[tag]);
      }
      /* eslint-enable guard-for-in, no-await-in-loop, no-restricted-syntax */
    }
  }

  async setOrNotCapabilityValue(capability, value) {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.instanceLog(capability, 'is', value))
        .catch((error) => this.instanceError(error.message));
    }
  }

  instanceLog(...message) {
    this.log(this.getName(), '-', ...message);
  }

  instanceError(...message) {
    this.error(this.getName(), '-', ...message);
  }
}

module.exports = MELCloudDeviceMixin;
