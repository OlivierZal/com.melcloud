const Homey = require('homey'); // eslint-disable-line import/no-unresolved

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

    await this.setWarning(null);
    if (!store.warnedAboutSettings) {
      await this.setWarning('NEW: customize your dashboard from the settings!');
      await this.setStoreValue('warnedAboutSettings', true);
      await this.setWarning(null);
    }

    await this.handleCapabilities();

    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('onoff.forced_hot_water', this.onCapabilityForcedHotWater.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilityTargetTemperatureZone1.bind(this));
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', this.onCapabilityHeatFlowTemperatureZone1.bind(this));

    if (store.canCool) {
      this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', this.onCapabilityOperationModeZone1.bind(this));
      this.registerCapabilityListener('target_temperature.zone1_flow_cool', this.onCapabilityCoolFlowTemperatureZone1.bind(this));
    } else {
      this.registerCapabilityListener('operation_mode_zone.zone1', this.onCapabilityOperationModeZone1.bind(this));
    }

    if (store.hasZone2) {
      this.registerCapabilityListener('target_temperature.zone2', this.onCapabilityTargetTemperatureZone2.bind(this));
      this.registerCapabilityListener('target_temperature.zone2_flow_heat', this.onCapabilityHeatFlowTemperatureZone2.bind(this));
      if (store.canCool) {
        this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', this.onCapabilityOperationModeZone2.bind(this));
        this.registerCapabilityListener('target_temperature.zone2_flow_cool', this.onCapabilityCoolFlowTemperatureZone2.bind(this));
      } else {
        this.registerCapabilityListener('operation_mode_zone.zone2', this.onCapabilityOperationModeZone2.bind(this));
      }
    }

    this.registerCapabilityListener('target_temperature.tank_water', this.onCapabilityTankWaterTemperature.bind(this));

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
    const store = this.getStore();
    const json = {
      DeviceID: data.id,
      EffectiveFlags: 0,
      ForcedHotWaterMode: this.getCapabilityValue('onoff.forced_hot_water'),
      HasPendingCommand: true,
      Power: this.getCapabilityValue('onoff'),
      SetHeatFlowTemperatureZone1: this.getCapabilityValue('target_temperature.zone1_flow_heat'),
      SetTankWaterTemperature: this.getCapabilityValue('target_temperature.tank_water'),
      SetTemperatureZone1: this.getCapabilityValue('target_temperature'),
    };

    if (store.canCool) {
      json.OperationModeZone1 = Number(this.getCapabilityValue('operation_mode_zone.zone1'));
      json.SetCoolFlowTemperatureZone1 = this.getCapabilityValue('target_temperature.zone1_flow_cool');
    } else {
      json.OperationModeZone1 = Number(this.getCapabilityValue('operation_mode_zone_with_cool.zone1'));
    }

    if (store.hasZone2) {
      json.SetTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2');
      json.SetHeatFlowTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2_flow_heat');
      if (store.canCool) {
        json.OperationModeZone2 = Number(this.getCapabilityValue('operation_mode_zone.zone2'));
        json.SetCoolFlowTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2_flow_cool');
      } else {
        json.OperationModeZone2 = Number(this.getCapabilityValue('operation_mode_zone_with_cool.zone2'));
      }
    }
    Object.entries(updateJson).forEach((entry) => {
      const [key, value] = entry;
      json[key] = value;
    });
    const resultData = await this.homey.app.setDevice(this, json);

    this.updateCapabilities(resultData);
  }

  async updateCapabilities(resultData) {
    const data = this.getData();
    const store = this.getStore();

    const operationModeZone1 = String(resultData.OperationModeZone1);
    const operationModeZone2 = String(resultData.OperationModeZone2);

    await this.setOrNotCapabilityValue('onoff', resultData.Power);
    await this.setOrNotCapabilityValue('onoff.forced_hot_water', resultData.ForcedHotWaterMode);
    await this.setOrNotCapabilityValue('eco_hot_water', resultData.EcoHotWater);
    await this.setOrNotCapabilityValue('operation_mode_state', operationModeFromDevice(resultData.OperationMode));
    await this.setOrNotCapabilityValue('measure_temperature', resultData.RoomTemperatureZone1);
    await this.setOrNotCapabilityValue('measure_temperature.outdoor', resultData.OutdoorTemperature);
    await this.setOrNotCapabilityValue('measure_temperature.tank_water', resultData.TankWaterTemperature);
    await this.setOrNotCapabilityValue('target_temperature', resultData.SetTemperatureZone1);
    await this.setOrNotCapabilityValue('target_temperature.tank_water', resultData.SetTankWaterTemperature);
    await this.setOrNotCapabilityValue('target_temperature.zone1_flow_heat', resultData.SetHeatFlowTemperatureZone1);

    if (store.canCool) {
      await this.setOrNotCapabilityValue('operation_mode_zone_with_cool.zone1', operationModeZone1);
      await this.setOrNotCapabilityValue('target_temperature.zone1_flow_cool', resultData.SetCoolFlowTemperatureZone1);
    } else {
      await this.setOrNotCapabilityValue('operation_mode_zone.zone1', operationModeZone1);
    }

    if (store.hasZone2) {
      await this.setOrNotCapabilityValue('measure_temperature.zone2', resultData.RoomTemperatureZone2);
      await this.setOrNotCapabilityValue('target_temperature.zone2', resultData.SetTemperatureZone2);
      await this.setOrNotCapabilityValue('target_temperature.zone2_flow_heat', resultData.SetHeatFlowTemperatureZone2);

      if (store.canCool) {
        await this.setOrNotCapabilityValue('operation_mode_zone_with_cool.zone2', operationModeZone2);
        await this.setOrNotCapabilityValue('target_temperature.zone2_flow_cool', resultData.SetCoolFlowTemperatureZone2);
      } else {
        await this.setOrNotCapabilityValue('operation_mode_zone.zone2', operationModeZone2);
      }
    }

    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    const deviceList = await this.homey.app.listDevices(this.driver);
    for (const device of deviceList) {
      if (device.DeviceID === data.id && device.BuildingID === data.buildingid) {
        let hasStoreChanged = false;
        if (device.Device.CanCool !== store.canCool) {
          await this.setStoreValue('canCool', device.Device.CanCool);
          hasStoreChanged = true;
        }
        if (device.Device.HasZone2 !== store.hasZone2) {
          await this.setStoreValue('hasZone2', device.Device.HasZone2);
          hasStoreChanged = true;
        }
        if (hasStoreChanged) {
          await this.handleCapabilities();
        }

        await this.setOrNotCapabilityValue('alarm_generic.booster_heater1', device.Device.BoosterHeater1Status);
        await this.setOrNotCapabilityValue('alarm_generic.booster_heater2', device.Device.BoosterHeater2Status);
        await this.setOrNotCapabilityValue('alarm_generic.booster_heater2_plus', device.Device.BoosterHeater2PlusStatus);
        await this.setOrNotCapabilityValue('alarm_generic.defrost_mode', Boolean(device.Device.DefrostMode));
        await this.setOrNotCapabilityValue('alarm_water.immersion_heater', device.Device.ImmersionHeaterStatus);
        await this.setOrNotCapabilityValue('measure_power.heat_pump_frequency', device.Device.HeatPumpFrequency);
        await this.setOrNotCapabilityValue('measure_temperature.flow', device.Device.FlowTemperature);
        await this.setOrNotCapabilityValue('measure_temperature.return', device.Device.ReturnTemperature);
        break;
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

    const interval = this.getSetting('interval');
    this.syncTimeout = this.homey
      .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
    this.log(`\`${this.getName()}\`: sync from device has been completed, next one in ${interval} minutes`);
  }

  async onCapabilityOnoff(value) {
    const updateJson = {
      EffectiveFlags: 0x1,
      Power: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityForcedHotWater(value) {
    const updateJson = {
      EffectiveFlags: 0x10000,
      ForcedHotWaterMode: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityOperationModeZone1(value) {
    const updateJson = {
      EffectiveFlags: 0x8,
      OperationModeZone1: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityOperationModeZone2(value) {
    const updateJson = {
      EffectiveFlags: 0x10,
      OperationModeZone2: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityTargetTemperatureZone1(value) {
    const updateJson = {
      EffectiveFlags: 0x200000080,
      SetTemperatureZone1: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityCoolFlowTemperatureZone1(value) {
    const updateJson = {
      EffectiveFlags: 0x1000000000000,
      SetCoolFlowTemperatureZone1: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityHeatFlowTemperatureZone1(value) {
    const updateJson = {
      EffectiveFlags: 0x1000000000000,
      SetHeatFlowTemperatureZone1: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityTargetTemperatureZone2(value) {
    const updateJson = {
      EffectiveFlags: 0x800000200,
      SetTemperatureZone2: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityCoolFlowTemperatureZone2(value) {
    const updateJson = {
      EffectiveFlags: 0x1000000000000,
      SetCoolFlowTemperatureZone2: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityHeatFlowTemperatureZone2(value) {
    const updateJson = {
      EffectiveFlags: 0x1000000000000,
      SetHeatFlowTemperatureZone2: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onCapabilityTankWaterTemperature(value) {
    const updateJson = {
      EffectiveFlags: 0x1000000000020,
      SetTankWaterTemperature: value,
    };
    await this.syncDeviceFromData(updateJson);
  }

  async onSettings(event) {
    if (!event.changedKeys.includes('interval') || event.changedKeys.length > 1) {
      await this.handleDashboardCapabilities(event.changedKeys, event.newSettings);
      await this.setWarning('Exit device and return to refresh your dashboard');
      /* eslint-disable no-await-in-loop, no-restricted-syntax */
      for (const capability of event.changedKeys) {
        if (!capability.startsWith('meter_power')) {
          await this.syncDataFromDevice();
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

  async setOrNotCapabilityValue(capability, value) {
    if (this.hasCapability(capability) && value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(`\`${this.getName()}\`: capability \`${capability}\` is \`${value}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`${capability}\` has not been set to \`${value}\` (${error})`));
    }
  }
}

module.exports = MELCloudAtwDevice;
