const Homey = require('homey'); // eslint-disable-line import/no-unresolved

function operationModeFromDevice(value) {
  switch (value) {
    case 0:
      return 'idle';
    case 1:
      return 'dhw';
    case 2:
      return 'heating';
    case 3:
      return 'cooling';
    case 4:
      return 'defrost';
    case 5:
      return 'standby';
    case 6:
      return 'legionella';
    default:
      throw new Error(value);
  }
}

class MELCloudAtwDevice extends Homey.Device {
  /* eslint-disable no-await-in-loop, no-restricted-syntax */
  async handleCapabilities() {
    const settings = this.getSettings();
    const store = this.getStore();

    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;

    for (const capability of currentCapabilities) {
      if (!requiredCapabilities.includes(capability)) {
        await this.removeCapability(capability);
      }
    }

    for (const capability of this.driver.atwCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability);
      }
    }

    if (store.canCool) {
      for (const capability of this.driver.notCoolAtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
      for (const capability of this.driver.coolAtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability);
        }
      }
    } else {
      for (const capability of this.driver.coolAtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
      for (const capability of this.driver.notCoolAtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability);
        }
      }
    }

    if (store.hasZone2) {
      for (const capability of this.driver.zone2AtwCapabilities) {
        if (!this.hasCapability(capability)) {
          await this.addCapability(capability);
        }
      }
      if (store.canCool) {
        for (const capability of this.driver.notCoolZone2AtwCapabilities) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability);
          }
        }
        for (const capability of this.driver.coolZone2AtwCapabilities) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability);
          }
        }
      } else {
        for (const capability of this.driver.coolZone2AtwCapabilities) {
          if (this.hasCapability(capability)) {
            await this.removeCapability(capability);
          }
        }
        for (const capability of this.driver.notCoolZone2AtwCapabilities) {
          if (!this.hasCapability(capability)) {
            await this.addCapability(capability);
          }
        }
      }
    } else {
      for (const capability of this.driver.zone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
      for (const capability of this.driver.coolZone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
      for (const capability of this.driver.notCoolZone2AtwCapabilities) {
        if (this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
    }

    for (const capability of this.driver.otherAtwCapabilities) {
      if (!this.hasCapability(capability)) {
        await this.addCapability(capability);
      }
    }

    await this.handleDashboardCapabilities(settings);
  }

  async handleDashboardCapabilities(settings, capabilities) {
    const dashboardCapabilities = capabilities ?? this.driver.dashboardAtwCapabilities;
    for (const capability of dashboardCapabilities) {
      if (this.driver.dashboardAtwCapabilities.includes(capability)) {
        if (settings[capability] && !this.hasCapability(capability)) {
          await this.addCapability(capability);
        } else if (!settings[capability] && this.hasCapability(capability)) {
          await this.removeCapability(capability);
        }
      }
    }
  }
  /* eslint-enable no-await-in-loop, no-restricted-syntax */

  async onInit() {
    await this.setWarning(null);

    const store = this.getStore();
    this.updateJson = {};
    await this.handleCapabilities();

    this.registerCapabilityListener('onoff', async (value) => { await this.onCapabilityOnoff(value); });
    this.registerCapabilityListener('onoff.forced_hot_water', async (value) => { await this.onCapabilityForcedHotWater(value); });
    this.registerCapabilityListener('target_temperature', async (value) => { await this.onCapabilityTargetTemperatureZone1(value); });
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', async (value) => { await this.onCapabilityHeatFlowTemperatureZone1(value); });

    if (store.canCool) {
      this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', async (value) => { await this.onCapabilityOperationModeZone1WithCool(value); });
      this.registerCapabilityListener('target_temperature.zone1_flow_cool', async (value) => { await this.onCapabilityCoolFlowTemperatureZone1(value); });
    } else {
      this.registerCapabilityListener('operation_mode_zone.zone1', async (value) => { await this.onCapabilityOperationModeZone1(value); });
    }

    if (store.hasZone2) {
      this.registerCapabilityListener('target_temperature.zone2', async (value) => { await this.onCapabilityTargetTemperatureZone2(value); });
      this.registerCapabilityListener('target_temperature.zone2_flow_heat', async (value) => { await this.onCapabilityHeatFlowTemperatureZone2(value); });
      if (store.canCool) {
        this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', async (value) => { await this.onCapabilityOperationModeZone2WithCool(value); });
        this.registerCapabilityListener('target_temperature.zone2_flow_cool', async (value) => { await this.onCapabilityCoolFlowTemperatureZone2(value); });
      } else {
        this.registerCapabilityListener('operation_mode_zone.zone2', async (value) => { await this.onCapabilityOperationModeZone2(value); });
      }
    }

    this.registerCapabilityListener('target_temperature.tank_water', async (value) => { await this.onCapabilityTankWaterTemperature(value); });

    await this.homey.app.syncDataFromDevice(this);
    await this.runEnergyReports();
    this.reportTimeout = this.homey.setTimeout(() => {
      this.runEnergyReports();
      this.reportInterval = this.homey.setInterval(() => {
        this.runEnergyReports();
      }, 24 * 60 * 60 * 1000);
    }, new Date().setHours(24, 0, 0, 0) - new Date().getTime());
  }

  async runEnergyReports() {
    const reportMapping = {};
    const report = {};
    report.daily = await this.homey.app.fetchEnergyReport(this, true);
    report.total = await this.homey.app.fetchEnergyReport(this, false);
    Object.entries(report).forEach((entry) => {
      const [period, data] = entry;
      ['Consumed', 'Produced'].forEach((type) => {
        reportMapping[`meter_power.${period}_${type.toLowerCase()}`] = 0;
        ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
          reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`] = data[`Total${mode}${type}`];
          reportMapping[`meter_power.${period}_${type.toLowerCase()}`] += reportMapping[`meter_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`];
        });
      });
      ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
        reportMapping[`meter_power.${period}_cop_${mode.toLowerCase()}`] = data[`Total${mode}Produced`] / data[`Total${mode}Consumed`];
      });
      reportMapping[`meter_power.${period}_cop`] = reportMapping[`meter_power.${period}_produced`] / reportMapping[`meter_power.${period}_consumed`];
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

  async endSyncData(deviceFromList) {
    if (deviceFromList) {
      const store = this.getStore();

      let hasStoreChanged = false;
      if (deviceFromList.Device.CanCool !== store.canCool) {
        await this.setStoreValue('canCool', deviceFromList.Device.CanCool);
        hasStoreChanged = true;
      }
      if (deviceFromList.Device.HasZone2 !== store.hasZone2) {
        await this.setStoreValue('hasZone2', deviceFromList.Device.HasZone2);
        hasStoreChanged = true;
      }
      if (hasStoreChanged) {
        await this.handleCapabilities();
      }
    }

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(() => { this.homey.app.syncDataFromDevice(this); }, interval * 60 * 1000);
    this.log(this.getName(), '- Next sync from device in', interval, 'minutes');
  }

  async onCapabilityOnoff(value) {
    this.homey.clearTimeout(this.syncTimeout);

    await this.setWarning(null);
    if (this.getSetting('always_on')) {
      await this.setWarning('Setting `Always On` is activated');
    }

    this.updateJson.onoff = this.getCapabilityValueToDevice('onoff', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityForcedHotWater(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['onoff.forced_hot_water'] = this.getCapabilityValueToDevice('onoff.forced_hot_water', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityOperationModeZone1(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['operation_mode_zone.zone1'] = this.getCapabilityValueToDevice('operation_mode_zone.zone1', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityOperationModeZone1WithCool(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['operation_mode_zone_with_cool.zone1'] = this.getCapabilityValueToDevice('operation_mode_zone_with_cool.zone1', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityOperationModeZone2(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['operation_mode_zone.zone2'] = this.getCapabilityValueToDevice('operation_mode_zone.zone2', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityOperationModeZone2WithCool(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['operation_mode_zone_with_cool.zone2'] = this.getCapabilityValueToDevice('operation_mode_zone_with_cool.zone2', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityTargetTemperatureZone1(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson.target_temperature = this.getCapabilityValueToDevice('target_temperature', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityCoolFlowTemperatureZone1(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.zone1_flow_cool'] = this.getCapabilityValueToDevice('target_temperature.zone1_flow_cool', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityHeatFlowTemperatureZone1(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.zone1_flow_heat'] = this.getCapabilityValueToDevice('target_temperature.zone1_flow_heat', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityTargetTemperatureZone2(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.zone2'] = this.getCapabilityValueToDevice('target_temperature.zone2', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityCoolFlowTemperatureZone2(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.zone2_flow_cool'] = this.getCapabilityValueToDevice('target_temperature.zone2_flow_cool', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityHeatFlowTemperatureZone2(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.zone2_flow_heat'] = this.getCapabilityValueToDevice('target_temperature.zone2_flow_heat', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  async onCapabilityTankWaterTemperature(value) {
    this.homey.clearTimeout(this.syncTimeout);

    this.updateJson['target_temperature.tank_water'] = this.getCapabilityValueToDevice('target_temperature.tank_water', value);

    this.syncTimeout = this.homey.setTimeout(() => {
      if (this.updateJson) {
        this.homey.app.syncDataToDevice(this, this.updateJson);
        this.updateJson = {};
      }
    }, 1 * 1000);
  }

  getCapabilityValueToDevice(capability, value) {
    const newValue = value ?? this.getCapabilityValue(capability);
    switch (capability) {
      case 'onoff':
        return this.getSetting('always_on') ? true : newValue;
      case 'operation_mode_zone.zone1':
      case 'operation_mode_zone.zone2':
      case 'operation_mode_zone_with_cool.zone1':
      case 'operation_mode_zone_with_cool.zone2':
        return Number(newValue);
      default:
        return newValue;
    }
  }

  async setCapabilityValueFromDevice(capability, value) {
    try {
      let newValue = value;
      switch (capability) {
        case 'alarm_generic.defrost_mode':
          newValue = Boolean(newValue);
          break;
        case 'onoff':
          if (this.getSetting('always_on') && !newValue) {
            await this.setSettings({ always_on: false });
          }
          break;
        case 'operation_mode_state':
          newValue = operationModeFromDevice(newValue);
          break;
        case 'operation_mode_zone.zone1':
        case 'operation_mode_zone.zone2':
        case 'operation_mode_zone_with_cool.zone1':
        case 'operation_mode_zone_with_cool.zone2':
          newValue = String(newValue);
          break;
        default:
      }
      await this.setOrNotCapabilityValue(capability, newValue);
    } catch (error) {
      this.error(this.getName(), '-', capability, 'cannot be set from', error.message);
    }
  }

  async setOrNotCapabilityValue(capability, value) {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(this.getName(), '-', capability, 'is', value))
        .catch((error) => this.error(this.getName(), '-', error.message));
    }
  }

  async onSettings(event) {
    await this.setWarning(null);

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
          await this.onCapabilityOnoff(true);
          hasSynced = true;
          needsSync = false;
        }
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

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
}

module.exports = MELCloudAtwDevice;
