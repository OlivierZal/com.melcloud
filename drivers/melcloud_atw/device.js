const Homey = require('homey'); // eslint-disable-line import/no-unresolved

function targetTemperatureToDevice(value) {
  if (value > 30) {
    return 30;
  }
  return value;
}

function operationModeFromDevice(value) {
  switch (value) {
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
    case 0:
    default:
      return 'idle';
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

    await this.handleDashboardCapabilities(this.driver.dashboardCapabilities, settings);
  }

  async handleDashboardCapabilities(capabilities, settings) {
    for (const capability of capabilities) {
      if (this.driver.dashboardCapabilities.includes(capability)) {
        if (!settings[capability] && this.hasCapability(capability)) {
          await this.removeCapability(capability);
        } else if (settings[capability] && !this.hasCapability(capability)) {
          await this.addCapability(capability);
        }
      }
    }
  }
  /* eslint-enable no-await-in-loop, no-restricted-syntax */

  async onInit() {
    const store = this.getStore();

    await this.setWarning('NEW: customize your dashboard from the settings!');

    await this.handleCapabilities();

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('onoff.forced_hot_water', this.onCapabilityForcedHotWater.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperatureZone1.bind(this));
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', this.onCapabilityHeatFlowTemperatureZone1.bind(this));

    if (store.canCool) {
      this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', this.onCapabilityOperationModeZone1WithCool.bind(this));
      this.registerCapabilityListener('target_temperature.zone1_flow_cool', this.onCapabilityCoolFlowTemperatureZone1.bind(this));
    } else {
      this.registerCapabilityListener('operation_mode_zone.zone1', this.onCapabilityOperationModeZone1.bind(this));
    }

    if (store.hasZone2) {
      this.registerCapabilityListener('target_temperature.zone2', this.onCapabilityTargetTemperatureZone2.bind(this));
      this.registerCapabilityListener('target_temperature.zone2_flow_heat', this.onCapabilityHeatFlowTemperatureZone2.bind(this));
      if (store.canCool) {
        this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', this.onCapabilityOperationModeZone2WithCool.bind(this));
        this.registerCapabilityListener('target_temperature.zone2_flow_cool', this.onCapabilityCoolFlowTemperatureZone2.bind(this));
      } else {
        this.registerCapabilityListener('operation_mode_zone.zone2', this.onCapabilityOperationModeZone2.bind(this));
      }
    }

    this.registerCapabilityListener('target_temperature.tank_water', this.onCapabilityTankWaterTemperature.bind(this));

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

    this.reportTimeout = this.homey
      .setTimeout(this.runEnergyReports.bind(this), 24 * 60 * 60 * 1000);
    this.log(`\`${this.getName()}\`: energy reports have been processed`);
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
    this.log(`\`${this.getName()}\`: sync from device has been completed, next one in ${interval} minutes`);
  }

  async onCapabilityOnoff(value) {
    await this.homey.app.syncDataToDevice(this, { onoff: value });
  }

  async onCapabilityForcedHotWater(value) {
    await this.homey.app.syncDataToDevice(this, { 'onoff.forced_hot_water': value });
  }

  async onCapabilityOperationModeZone1(value) {
    await this.homey.app.syncDataToDevice(this, { 'operation_mode_zone.zone1': value });
  }

  async onCapabilityOperationModeZone1WithCool(value) {
    await this.homey.app.syncDataToDevice(this, { 'operation_mode_zone_with_cool.zone1': value });
  }

  async onCapabilityOperationModeZone2(value) {
    await this.homey.app.syncDataToDevice(this, { 'operation_mode_zone.zone2': value });
  }

  async onCapabilityOperationModeZone2WithCool(value) {
    await this.homey.app.syncDataToDevice(this, { 'operation_mode_zone_with_cool.zone2': value });
  }

  async onCapabilityTargetTemperatureZone1(value) {
    await this.homey.app.syncDataToDevice(this, { target_temperature: value });
  }

  async onCapabilityCoolFlowTemperatureZone1(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.zone1_flow_cool': value });
  }

  async onCapabilityHeatFlowTemperatureZone1(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.zone1_flow_heat': value });
  }

  async onCapabilityTargetTemperatureZone2(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.zone2': value });
  }

  async onCapabilityCoolFlowTemperatureZone2(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.zone2_flow_cool': value });
  }

  async onCapabilityHeatFlowTemperatureZone2(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.zone2_flow_heat': value });
  }

  async onCapabilityTankWaterTemperature(value) {
    await this.homey.app.syncDataToDevice(this, { 'target_temperature.tank_water': value });
  }

  getCapabilityValueToDevice(capability, value) {
    let newValue = value;
    if (newValue === undefined) {
      newValue = this.getCapabilityValue(capability);
    }
    switch (capability) {
      case 'target_temperature':
        return targetTemperatureToDevice(newValue);
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
    let newValue = value;
    switch (capability) {
      case 'alarm_generic.defrost_mode':
        newValue = Boolean(newValue);
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
  }

  async setOrNotCapabilityValue(capability, value) {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(`\`${this.getName()}\`: capability \`${capability}\` is \`${value}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`${capability}\` has not been set to \`${value}\` (${error})`));
    }
  }

  async onSettings(event) {
    if (event.changedKeys.includes('interval')) {
      this.homey.clearTimeout(this.syncTimeout);

      this.homey.app.syncDataFromDevice(this);

      const { interval } = event.newSettings;
      this.syncTimeout = this.homey
        .setTimeout(() => { this.homey.app.syncDataFromDevice(this); }, interval * 60 * 1000);
      this.log(`\`${this.getName()}\`: sync from device has been completed, sync from device in ${interval} minutes`);
    }

    if (!event.changedKeys.includes('interval') || event.changedKeys.length > 1) {
      await this.handleDashboardCapabilities(event.changedKeys, event.newSettings);
      await this.setWarning('Exit device and return to refresh your dashboard');

      /* eslint-disable no-await-in-loop, no-restricted-syntax */
      for (const capability of event.changedKeys) {
        if (!capability.startsWith('meter_power')) {
          await this.syncDataFromDevice(this);
          break;
        }
      }
      for (const capability of event.changedKeys) {
        if (capability.startsWith('meter_power')) {
          await this.runEnergyReports();
          break;
        }
      }
      /* eslint-enable no-await-in-loop, no-restricted-syntax */

      await this.setWarning(null);
    }
  }

  onDeleted() {
    this.homey.clearTimeout(this.reportTimeout);
    this.homey.clearTimeout(this.syncTimeout);
  }
}

module.exports = MELCloudAtwDevice;
