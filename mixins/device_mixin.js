const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDeviceMixin extends Homey.Device {
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

  async onInit() {
    await this.handleCapabilities();
    await this.handleDashboardCapabilities();

    this.updateJson = {};
    this.registerCapabilityListeners();

    await this.homey.app.syncDataFromDevice(this);
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
        .setTimeout(() => { this.homey.app.syncDataFromDevice(this); }, 1 * 1000);
    }
  }

  onDeleted() {
    this.homey.clearInterval(this.reportInterval);
    this.homey.clearTimeout(this.reportTimeout);
    this.homey.clearTimeout(this.syncTimeout);
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
