const MELCloudDeviceMixin = require('../../mixins/device_mixin');

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

class MELCloudAtwDevice extends MELCloudDeviceMixin {
  async handleCapabilities() {
    const store = this.getStore();
    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;

    /* eslint-disable no-await-in-loop, no-restricted-syntax */
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
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
  }

  registerCapabilityListeners() {
    this.registerCapabilityListener('onoff', async (value) => { await this.onCapability('onoff', value); });
    this.registerCapabilityListener('onoff.forced_hot_water', async (value) => { await this.onCapability('onoff.forced_hot_water', value); });
    this.registerCapabilityListener('target_temperature', async (value) => { await this.onCapability('target_temperature', value); });
    this.registerCapabilityListener('target_temperature.zone1_flow_cool', async (value) => { await this.onCapability('target_temperature.zone1_flow_cool', value); });
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', async (value) => { await this.onCapability('target_temperature.zone1_flow_heat', value); });
    this.registerCapabilityListener('target_temperature.zone2', async (value) => { await this.onCapability('target_temperature.zone2', value); });
    this.registerCapabilityListener('target_temperature.zone2_flow_cool', async (value) => { await this.onCapability('target_temperature.zone2_flow_cool', value); });
    this.registerCapabilityListener('target_temperature.zone2_flow_heat', async (value) => { await this.onCapability('target_temperature.zone2_flow_heat', value); });
    this.registerCapabilityListener('target_temperature.tank_water', async (value) => { await this.onCapability('target_temperature.tank_water', value); });
    this.registerCapabilityListener('operation_mode_zone.zone1', async (value) => { await this.onCapability('operation_mode_zone.zone1', value); });
    this.registerCapabilityListener('operation_mode_zone.zone2', async (value) => { await this.onCapability('operation_mode_zone.zone2', value); });
    this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', async (value) => { await this.onCapability('operation_mode_zone_with_cool.zone1', value); });
    this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', async (value) => { await this.onCapability('operation_mode_zone_with_cool.zone2', value); });
  }

  async runEnergyReports() {
    const reportMapping = {};
    const report = {};
    report.daily = await this.homey.app.reportEnergyCost(this, true);
    report.total = await this.homey.app.reportEnergyCost(this, false);
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

    /* eslint-disable guard-for-in, no-await-in-loop, no-restricted-syntax */
    for (const capability in reportMapping) {
      await this.setCapabilityValueFromDevice(capability, reportMapping[capability]);
    }
    /* eslint-enable guard-for-in, no-await-in-loop, no-restricted-syntax */

    this.instanceLog('Energy reports have been processed');
  }

  async customSyncData(deviceFromListDevices) {
    if (deviceFromListDevices) {
      const store = this.getStore();

      let hasStoreChanged = false;
      if (deviceFromListDevices.Device.CanCool !== store.canCool) {
        await this.setStoreValue('canCool', deviceFromListDevices.Device.CanCool);
        hasStoreChanged = true;
      }
      if (deviceFromListDevices.Device.HasZone2 !== store.hasZone2) {
        await this.setStoreValue('hasZone2', deviceFromListDevices.Device.HasZone2);
        hasStoreChanged = true;
      }

      if (hasStoreChanged) {
        await this.handleCapabilities();
      }
    }
  }

  async onCapability(capability, value) {
    this.homey.clearTimeout(this.syncTimeout);

    switch (capability) {
      case 'onoff':
        if (this.getSetting('always_on')) {
          await this.setWarning('Setting `Always On` is activated');
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
        case 'alarm_generic.defrost_mode':
          newValue = Boolean(newValue);
          break;
        default:
      }
      await this.setOrNotCapabilityValue(capability, newValue);
    } catch (error) {
      this.instanceError(capability, 'cannot be set from', String(error.message));
    }
  }
}

module.exports = MELCloudAtwDevice;
