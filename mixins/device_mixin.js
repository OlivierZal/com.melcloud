const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDeviceMixin extends Homey.Device {
  async onInit() {
    await this.handleCapabilities();
    await this.handleDashboardCapabilities();

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
    const data = this.getData();
    const deviceList = await this.homey.app.listDevices(this);
    /* eslint-disable no-restricted-syntax */
    for (const deviceFromListDevices of deviceList) {
      if (deviceFromListDevices.DeviceID === data.id
          && deviceFromListDevices.BuildingID === data.buildingid) {
        return deviceFromListDevices;
      }
    }
    /* eslint-enable no-restricted-syntax */
    this.error(this.getName(), '- Not found while searching from device list');
    return null;
  }

  async syncDataFromDevice() {
    const resultData = await this.homey.app.getDevice(this);
    await this.syncData(resultData);
  }

  async syncDataToDevice(updateJson) {
    const data = this.getData();
    const json = {
      DeviceID: data.id,
      HasPendingCommand: true,
    };
    let effectiveFlags = BigInt(0);
    Object.keys(this.driver.setCapabilityMapping).forEach((capability) => {
      if (this.hasCapability(capability)) {
        if (capability in updateJson) {
          // eslint-disable-next-line no-bitwise
          effectiveFlags |= this.driver.getCapabilityEffectiveFlag(capability);
          json[
            this.driver.getCapabilityTag(capability)
          ] = updateJson[capability];
        } else {
          json[
            this.driver.getCapabilityTag(capability)
          ] = this.getCapabilityValueToDevice(capability);
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
    this.log(this.getName(), '- Next sync from device in', interval, 'minutes');
  }

  async updateCapabilities(resultData) {
    if (resultData) {
      /* eslint-disable no-await-in-loop, no-restricted-syntax */
      for (const capability in this.driver.setCapabilityMapping) {
        if (!resultData.EffectiveFlags || (
          // eslint-disable-next-line no-bitwise
          this.driver.getCapabilityEffectiveFlag(capability) & BigInt(resultData.EffectiveFlags))
        ) {
          await this.setCapabilityValueFromDevice(
            capability,
            resultData[this.driver.getCapabilityTag(capability)],
          );
        }
      }

      for (const capability in this.driver.getCapabilityMapping) {
        if (Object.prototype.hasOwnProperty.call(this.driver.getCapabilityMapping, capability)) {
          await this.setCapabilityValueFromDevice(
            capability,
            resultData[this.driver.getCapabilityTag(capability)],
          );
        }
      }
      /* eslint-enable no-await-in-loop, no-restricted-syntax */
    }
  }

  async updateListCapabilities(deviceFromListDevices) {
    if (deviceFromListDevices) {
      /* eslint-disable no-await-in-loop, no-restricted-syntax */
      for (const capability in this.driver.listCapabilityMapping) {
        if (Object.prototype.hasOwnProperty.call(
          this.driver.listCapabilityMapping,
          capability,
        )) {
          await this.setCapabilityValueFromDevice(
            capability,
            deviceFromListDevices.Device[this.driver.getCapabilityTag(capability)],
          );
        }
      }
      /* eslint-enable no-await-in-loop, no-restricted-syntax */
    }
  }

  async setOrNotCapabilityValue(capability, value) {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(this.getName(), '-', capability, 'is', value))
        .catch((error) => this.error(this.getName(), '-', error.message));
    }
  }
}

module.exports = MELCloudDeviceMixin;
