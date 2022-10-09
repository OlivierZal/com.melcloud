const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudAtwDevice extends Homey.Device {
  cleanCapabilities() {
    const store = this.getStore();

    const currentCapabilities = this.getCapabilities();
    const requiredCapabilities = this.driver.manifest.capabilities;
    currentCapabilities.forEach((capability) => {
      if (!requiredCapabilities.includes(capability)) {
        this.removeCapability(capability);
      }
    });
    this.driver.atwCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
      }
    });
    if (store.canCool) {
      this.driver.notCoolAtwCapabilities.forEach((capability) => {
        if (this.hasCapability(capability)) {
          this.removeCapability(capability);
        }
      });
      this.driver.coolAtwCapabilities.forEach((capability) => {
        if (!this.hasCapability(capability)) {
          this.addCapability(capability);
        }
      });
    } else {
      this.driver.coolAtwCapabilities.forEach((capability) => {
        if (this.hasCapability(capability)) {
          this.removeCapability(capability);
        }
      });
      this.driver.notCoolAtwCapabilities.forEach((capability) => {
        if (!this.hasCapability(capability)) {
          this.addCapability(capability);
        }
      });
    }
    if (store.hasZone2) {
      this.driver.zone2AtwCapabilities.forEach((capability) => {
        if (!this.hasCapability(capability)) {
          this.addCapability(capability);
        }
      });
      if (store.canCool) {
        this.driver.notCoolZone2AtwCapabilities.forEach((capability) => {
          if (this.hasCapability(capability)) {
            this.removeCapability(capability);
          }
        });
        this.driver.coolZone2AtwCapabilities.forEach((capability) => {
          if (!this.hasCapability(capability)) {
            this.addCapability(capability);
          }
        });
      } else {
        this.driver.coolZone2AtwCapabilities.forEach((capability) => {
          if (this.hasCapability(capability)) {
            this.removeCapability(capability);
          }
        });
        this.driver.notCoolZone2AtwCapabilities.forEach((capability) => {
          if (!this.hasCapability(capability)) {
            this.addCapability(capability);
          }
        });
      }
    } else {
      this.driver.zone2AtwCapabilities.forEach((capability) => {
        if (this.hasCapability(capability)) {
          this.removeCapability(capability);
        }
      });
      this.driver.coolZone2AtwCapabilities.forEach((capability) => {
        if (this.hasCapability(capability)) {
          this.removeCapability(capability);
        }
      });
      this.driver.notCoolZone2AtwCapabilities.forEach((capability) => {
        if (this.hasCapability(capability)) {
          this.removeCapability(capability);
        }
      });
    }
    this.driver.otherAtwCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
      }
    });
  }

  async onInit() {
    await this.setWarning(null);
    this.cleanCapabilities();

    const store = this.getStore();
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
    await this.parseEnergyReports();
  }

  async parseEnergyReports() {
    this.homey.clearTimeout(this.reportTimeout);

    const reportData = {};
    reportData.daily = await this.homey.app.fetchEnergyReport(this, true);
    reportData.total = await this.homey.app.fetchEnergyReport(this, false);
    Object.entries(reportData).forEach(async (entry) => {
      const [period, data] = entry;
      const reportMapping = {};

      ['Consumed', 'Produced'].forEach((type) => {
        reportMapping[`measure_power.${period}_${type.toLowerCase()}`] = 0;
        ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
          reportMapping[`measure_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`] = data[`Total${mode}${type}`];
          reportMapping[`measure_power.${period}_${type.toLowerCase()}`] += reportMapping[`measure_power.${period}_${type.toLowerCase()}_${mode.toLowerCase()}`];
        });
      });
      ['Cooling', 'Heating', 'HotWater'].forEach((mode) => {
        reportMapping[`measure_power.${period}_cop_${mode.toLowerCase()}`] = data[`Total${mode}Produced`] / data[`Total${mode}Consumed`];
      });
      reportMapping[`measure_power.${period}_cop`] = reportMapping[`measure_power.${period}_produced`] / reportMapping[`measure_power.${period}_consumed`];
      Object.entries(reportMapping).forEach(async (total) => {
        const [capability, value] = total;
        await this.setOrNotCapabilityValue(capability, value);
      });
    });

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
    await this.setOrNotCapabilityValue('operation_mode_state', String(resultData.OperationMode));
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

    const deviceList = await this.homey.app.listDevices(this.driver);
    deviceList.forEach(async (device) => {
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
          this.cleanCapabilities();
        }

        await this.setOrNotCapabilityValue('alarm_generic.booster_heater1', device.Device.BoosterHeater1Status);
        await this.setOrNotCapabilityValue('alarm_generic.booster_heater2', device.Device.BoosterHeater2Status);
        await this.setOrNotCapabilityValue('alarm_generic.booster_heater2_plus', device.Device.BoosterHeater2PlusStatus);
        await this.setOrNotCapabilityValue('alarm_generic.defrost_mode', Boolean(device.Device.DefrostMode));
        await this.setOrNotCapabilityValue('alarm_water.immersion_heater', device.Device.ImmersionHeaterStatus);
        await this.setOrNotCapabilityValue('measure_power.heat_pump_frequency', device.Device.HeatPumpFrequency);
        await this.setOrNotCapabilityValue('measure_temperature.flow', device.Device.FlowTemperature);
        await this.setOrNotCapabilityValue('measure_temperature.return', device.Device.ReturnTemperature);
      }
    });

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

  async setOrNotCapabilityValue(capability, value) {
    if (value !== this.getCapabilityValue(capability)) {
      await this.setCapabilityValue(capability, value)
        .then(this.log(`\`${this.getName()}\`: capability \`${capability}\` is \`${value}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`${capability}\` has not been set to \`${value}\` (${error})`));
    }
  }
}

module.exports = MELCloudAtwDevice;
