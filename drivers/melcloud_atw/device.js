const http = require('http.min');
const MELCloudDeviceMixin = require('../melclouddevicemixin');

class MELCloudAtwDevice extends MELCloudDeviceMixin {
  async onInit() {
    const data = this.getData();

    const atwCapabilities = [
      'alarm_generic.booster_heater1',
      'alarm_generic.booster_heater2',
      'alarm_generic.booster_heater2_plus',
      'alarm_generic.defrost_mode',
      'alarm_water.immersion_heater',
      'measure_power.daily_consumed',
      'measure_power.daily_co_p',
      'measure_power.daily_produced',
      'measure_power.total_consumed',
      'measure_power.total_produced',
      'measure_power.heat_pump_frequency',
      'measure_temperature.flow',
      'measure_temperature.outdoor',
      'measure_temperature.return',
      'measure_temperature.tank_water',
      'measure_temperature.zone1',
      'onoff',
      'onoff.eco_hot_water',
      'onoff.forced_hot_water',
      'operation_mode_state',
      'operation_mode_zone.zone1',
      'target_temperature.tank_water',
      'target_temperature.zone1',
      'target_temperature.zone1_flow_heat',
    ];
    atwCapabilities.forEach((capability) => {
      if (!this.hasCapability(capability)) {
        this.addCapability(capability);
      }
    });
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('onoff.forced_hot_water', this.onCapabilityForcedHotWater.bind(this));
    this.registerCapabilityListener('target_temperature.zone1', this.onCapabilityTargetTemperatureZone1.bind(this));
    this.registerCapabilityListener('target_temperature.zone1_flow_heat', this.onCapabilityHeatFlowTemperatureZone1.bind(this));
    this.registerCapabilityListener('target_temperature.tank_water', this.onCapabilityTankWaterTemperature.bind(this));
    if (data.canCool) {
      const coolAtwCapabilities = [
        'operation_mode_zone_with_cool.zone1',
        'target_temperature.zone1_flow_cool',
      ];
      coolAtwCapabilities.forEach((capability) => {
        if (!this.hasCapability(capability)) {
          this.addCapability(capability);
        }
      });
      this.registerCapabilityListener('operation_mode_zone_with_cool.zone1', this.onCapabilityOperationModeZone1WithCool.bind(this));
      this.registerCapabilityListener('target_temperature.zone1_flow_cool', this.onCapabilityCoolFlowTemperatureZone1.bind(this));
    } else {
      if (!this.hasCapability('operation_mode_zone.zone1')) {
        this.addCapability('operation_mode_zone.zone1');
      }
      this.registerCapabilityListener('operation_mode_zone.zone1', this.onCapabilityOperationModeZone1.bind(this));
    }
    if (data.hasZone2) {
      const zone2AtwCapabilities = [
        'measure_temperature.zone2',
        'target_temperature.zone2',
        'target_temperature.zone2_flow_heat',
      ];
      zone2AtwCapabilities.forEach((capability) => {
        if (!this.hasCapability(capability)) {
          this.addCapability(capability);
        }
      });
      this.registerCapabilityListener('target_temperature.zone2', this.onCapabilityTargetTemperatureZone2.bind(this));
      this.registerCapabilityListener('target_temperature.zone2_flow_heat', this.onCapabilityHeatFlowTemperatureZone2.bind(this));
      if (data.canCool) {
        const coolZone2AtwCapabilities = [
          'operation_mode_zone_with_cool.zone2',
          'target_temperature.zone2_flow_cool',
        ];
        coolZone2AtwCapabilities.forEach((capability) => {
          if (!this.hasCapability(capability)) {
            this.addCapability(capability);
          }
        });
        this.registerCapabilityListener('operation_mode_zone_with_cool.zone2', this.onCapabilityOperationModeZone2WithCool.bind(this));
        this.registerCapabilityListener('target_temperature.zone2_flow_cool', this.onCapabilityCoolFlowTemperatureZone2.bind(this));
      } else {
        if (!this.hasCapability('operation_mode_zone.zone2')) {
          this.addCapability('operation_mode_zone.zone2');
        }
        this.registerCapabilityListener('operation_mode_zone.zone2', this.onCapabilityOperationModeZone2.bind(this));
      }
    }

    await this.syncDataFromDevice();
    await this.fetchEnergyReport();
  }

  async parseEnergyReport(report) {
    Object.entries(report).forEach(async (entry) => {
      const [period, data] = entry;

      const consumed = Number((data.TotalHeatingConsumed
        + data.TotalCoolingConsumed
        + data.TotalHotWaterConsumed).toFixed(0));
      await this.setCapabilityValue(`measure_power.${period}_consumed`, consumed)
        .then(this.log(`\`${this.getName()}\`: capability \`measure_power.${period}_consumed\` equals to \`${consumed}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_power.${period}_consumed\` has not been set (${error})`));

      const produced = Number((data.TotalHeatingProduced
        + data.TotalCoolingProduced
        + data.TotalHotWaterProduced).toFixed(0));
      await this.setCapabilityValue(`measure_power.${period}_produced`, produced)
        .then(this.log(`\`${this.getName()}\`: capability \`measure_power.${period}_produced\` equals to \`${produced}\``))
        .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_power.${period}_produced\` has not been set (${error})`));

      if (period === 'daily') {
        const coP = Number(data.CoP[0].toFixed(2));
        await this.setCapabilityValue(`measure_power.${period}_co_p`, coP)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_power.${period}_co_p\` equals to \`${coP}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_power.${period}_co_p\` has not been set (${error})`));
      }
    });
  }

  async syncDataFromDevice() {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const options = {
      uri: `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      this.log(`\`${this.getName()}\`: syncing from device...`);
      await http.get(options).then(async (result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        this.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }

        await this.setCapabilityValue('onoff', result.data.Power)
          .then(this.log(`\`${this.getName()}\`: capability \`onoff\` equals to \`${result.data.Power}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));

        await this.setCapabilityValue('onoff.eco_hot_water', result.data.EcoHotWater)
          .then(this.log(`\`${this.getName()}\`: capability \`onoff.eco_hot_water\` equals to \`${result.data.EcoHotWater}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff.eco_hot_water\` has not been set (${error})`));

        await this.setCapabilityValue('onoff.forced_hot_water', result.data.ForcedHotWaterMode)
          .then(this.log(`\`${this.getName()}\`: capability \`onoff.forced_hot_water\` equals to \`${result.data.ForcedHotWaterMode}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff.forced_hot_water\` has not been set (${error})`));

        await this.setCapabilityValue('measure_temperature.outdoor', result.data.OutdoorTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.outdoor\` equals to \`${result.data.OutdoorTemperature}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.outdoor\` has not been set (${error})`));

        const oldOperationMode = this.getCapabilityValue('operation_mode_state');
        const operationMode = String(result.data.OperationMode);
        await this.setCapabilityValue('operation_mode_state', operationMode)
          .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_state\` equals to \`${operationMode}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_state\` has not been set (${error})`));
        if (operationMode !== oldOperationMode) {
          this.driver.triggerOperationMode(this);
        }

        await this.setCapabilityValue('target_temperature.zone1', result.data.SetTemperatureZone1)
          .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1\` equals to \`${result.data.SetTemperatureZone1}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1\` has not been set (${error})`));

        await this.setCapabilityValue('target_temperature.zone1_flow_heat', result.data.SetHeatFlowTemperatureZone1)
          .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_heat\` equals to \`${result.data.SetHeatFlowTemperatureZone1}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_heat\` has not been set (${error})`));

        await this.setCapabilityValue('measure_temperature.zone1', result.data.RoomTemperatureZone1)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.zone1\` equals to \`${result.data.RoomTemperatureZone1}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.zone1\` has not been set (${error})`));

        await this.setCapabilityValue('target_temperature.tank_water', result.data.SetTankWaterTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.tank_water\` equals to \`${result.data.SetTankWaterTemperature}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.tank_water\` has not been set (${error})`));

        await this.setCapabilityValue('measure_temperature.tank_water', result.data.TankWaterTemperature)
          .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.tank_water\` equals to \`${result.data.TankWaterTemperature}\``))
          .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.tank_water\` has not been set (${error})`));

        let oldOperationModeZone1;
        const operationModeZone1 = String(result.data.OperationModeZone1);
        if (data.canCool) {
          oldOperationModeZone1 = this.getCapabilityValue('operation_mode_zone_with_cool.zone1');
          await this.setCapabilityValue('operation_mode_zone_with_cool.zone1', operationModeZone1)
            .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone1\` equals to \`${operationModeZone1}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone1\` has not been set (${error})`));
          if (operationModeZone1 !== oldOperationModeZone1) {
            this.driver.triggerOperationModeZone1WithCool(this);
          }
          await this.setCapabilityValue('target_temperature.zone1_flow_cool', result.data.SetCoolFlowTemperatureZone1)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_cool\` equals to \`${result.data.SetCoolFlowTemperatureZone1}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_cool\` has not been set (${error})`));
        } else {
          oldOperationModeZone1 = this.getCapabilityValue('operation_mode_zone.zone1');
          await this.setCapabilityValue('operation_mode_zone.zone1', operationModeZone1)
            .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone.zone1\` equals to \`${operationModeZone1}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone.zone1\` has not been set (${error})`));
          if (operationModeZone1 !== oldOperationModeZone1) {
            this.driver.triggerOperationModeZone1(this);
          }
        }

        if (data.hasZone2) {
          await this.setCapabilityValue('measure_temperature.zone2', result.data.RoomTemperatureZone2)
            .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.zone2\` equals to \`${result.data.RoomTemperatureZone2}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.zone2\` has not been set (${error})`));

          await this.setCapabilityValue('target_temperature.zone2', result.data.SetTemperatureZone2)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2\` equals to \`${result.data.SetTemperatureZone2}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2\` has not been set (${error})`));

          await this.setCapabilityValue('target_temperature.zone2_flow_heat', result.data.SetHeatFlowTemperatureZone2)
            .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_heat\` equals to \`${result.data.SetHeatFlowTemperatureZone2}\``))
            .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_heat\` has not been set (${error})`));

          let oldOperationModeZone2;
          const operationModeZone2 = String(result.data.OperationModeZone2);
          if (data.canCool) {
            oldOperationModeZone2 = this.getCapabilityValue('operation_mode_zone_with_cool.zone2');
            await this.setCapabilityValue('operation_mode_zone_with_cool.zone2', operationModeZone2)
              .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone2\` equals to \`${operationModeZone2}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone2\` has not been set (${error})`));
            if (operationModeZone2 !== oldOperationModeZone2) {
              this.driver.triggerOperationModeZone2WithCool(this);
            }
            await this.setCapabilityValue('target_temperature.zone2_flow_cool', result.data.SetCoolFlowTemperatureZone2)
              .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_cool\` equals to \`${result.data.SetCoolFlowTemperatureZone2}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_cool\` has not been set (${error})`));
          } else {
            oldOperationModeZone2 = this.getCapabilityValue('operation_mode_zone.zone2');
            await this.setCapabilityValue('operation_mode_zone.zone2', operationModeZone2)
              .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone.zone2\` equals to \`${operationModeZone2}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone.zone2\` has not been set (${error})`));
            if (operationModeZone2 !== oldOperationModeZone2) {
              this.driver.triggerOperationModeZone2(this);
            }
          }
        }

        // Update capabilities from data only available via `ListDevice`
        const deviceList = await this.driver.discoverDevices();
        deviceList.forEach(async (device) => {
          if (device.DeviceID === data.id && device.BuildingID === data.buildingid) {
            await this.setCapabilityValue('alarm_generic.booster_heater1', device.Device.BoosterHeater1Status)
              .then(this.log(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater1\` equals to \`${device.Device.BoosterHeater1Status}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater1\` has not been set (${error})`));

            await this.setCapabilityValue('alarm_generic.booster_heater2', device.Device.BoosterHeater2Status)
              .then(this.log(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater2\` equals to \`${device.Device.BoosterHeater2Status}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater2\` has not been set (${error})`));

            await this.setCapabilityValue('alarm_generic.booster_heater2_plus', device.Device.BoosterHeater2PlusStatus)
              .then(this.log(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater2_plus\` equals to \`${device.Device.BoosterHeater2PlusStatus}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`alarm_generic.booster_heater2_plus\` has not been set (${error})`));

            await this.setCapabilityValue('alarm_generic.defrost_mode', Boolean(device.Device.DefrostMode))
              .then(this.log(`\`${this.getName()}\`: capability \`alarm_generic.defrost_mode\` equals to \`${Boolean(device.Device.DefrostMode)}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`alarm_generic.defrost_mode\` has not been set (${error})`));

            await this.setCapabilityValue('alarm_water.immersion_heater', device.Device.ImmersionHeaterStatus)
              .then(this.log(`\`${this.getName()}\`: capability \`alarm_water.immersion_heater\` equals to \`${device.Device.ImmersionHeaterStatus}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`alarm_water.immersion_heater\` has not been set (${error})`));

            await this.setCapabilityValue('measure_power.heat_pump_frequency', device.Device.HeatPumpFrequency)
              .then(this.log(`\`${this.getName()}\`: capability \`measure_power.heat_pump_frequency\` equals to \`${device.Device.HeatPumpFrequency}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_power.heat_pump_frequency\` has not been set (${error})`));

            await this.setCapabilityValue('measure_temperature.flow', device.Device.FlowTemperature)
              .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.flow\` equals to \`${device.Device.FlowTemperature}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.flow\` has not been set (${error})`));

            await this.setCapabilityValue('measure_temperature.return', device.Device.ReturnTemperature)
              .then(this.log(`\`${this.getName()}\`: capability \`measure_temperature.return\` equals to \`${device.Device.ReturnTemperature}\``))
              .catch((error) => this.error(`\`${this.getName()}\`: capability \`measure_temperature.return\` has not been set (${error})`));
          }
        });
      });

      const interval = this.getSetting('interval');
      this.syncTimeout = this.homey
        .setTimeout(this.syncDataFromDevice.bind(this), interval * 60 * 1000);
      this.log(`\`${this.getName()}\`: sync from device has been successfully completed, next one in ${interval} minutes`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found while syncing from device`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing from device (${error})`);
      }
    }
  }

  async syncDeviceFromData() {
    this.homey.clearTimeout(this.syncTimeout);

    const data = this.getData();
    const options = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: {
        DeviceID: data.id,
        EffectiveFlags: 0x1000a000102b9,
        ForcedHotWaterMode: this.getCapabilityValue('onoff.forced_hot_water'),
        HasPendingCommand: true,
        OperationModeZone1: Number(this.getCapabilityValue('operation_mode_zone.zone1')),
        Power: this.getCapabilityValue('onoff'),
        SetHeatFlowTemperatureZone1: this.getCapabilityValue('target_temperature.zone1_flow_heat'),
        SetTankWaterTemperature: this.getCapabilityValue('target_temperature.tank_water'),
        SetTemperatureZone1: this.getCapabilityValue('target_temperature.zone1'),
      },
    };
    if (data.canCool) {
      options.json.SetCoolFlowTemperatureZone1 = this.getCapabilityValue('target_temperature.zone1_flow_cool');
    }
    if (data.hasZone2) {
      options.json.OperationModeZone2 = Number(this.getCapabilityValue('operation_mode_zone.zone2'));
      options.json.SetTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2');
      options.json.SetHeatFlowTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2_flow_heat');
      if (data.canCool) {
        options.json.SetCoolFlowTemperatureZone2 = this.getCapabilityValue('target_temperature.zone2_flow_cool');
      }
    }

    try {
      this.log(`\`${this.getName()}\`: syncing with device...`);
      await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        this.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
      });

      this.syncTimeout = this.homey.setTimeout(this.syncDataFromDevice.bind(this), 60 * 1000);
      this.log(`\`${this.getName()}\`: sync with device has been successfully completed, sync from device in 1 minute`);
    } catch (error) {
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found while syncing with device`);
      } else {
        this.error(`\`${this.getName()}\`: a problem occurred while syncing with device (${error})`);
      }
    }
  }

  async onCapabilityOnOff(isOn) {
    await this.setCapabilityValue('onoff', isOn)
      .then(this.log(`\`${this.getName()}\`: capability \`onoff\` equals to \`${isOn}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityForcedHotWater(isOn) {
    await this.setCapabilityValue('onoff.forced_hot_water', isOn)
      .then(this.log(`\`${this.getName()}\`: capability \`onoff.forced_hot_water\` equals to \`${isOn}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`onoff.forced_hot_water\` has not been set (${error})`));
    this.driver.triggerForcedHotWater(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationModeZone1(operationModeZone) {
    await this.setCapabilityValue('operation_mode_zone.zone1', operationModeZone)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone.zone1\` equals to \`${operationModeZone}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone.zone1\` has not been set (${error})`));
    this.driver.triggerOperationModeZone1(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationModeZone2(operationModeZone) {
    await this.setCapabilityValue('operation_mode_zone.zone2', operationModeZone)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone.zone2\` equals to \`${operationModeZone}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone.zone2\` has not been set (${error})`));
    this.driver.triggerOperationModeZone2(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationModeZone1WithCool(operationModeZone) {
    await this.setCapabilityValue('operation_mode_zone_with_cool.zone1', operationModeZone)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone1\` equals to \`${operationModeZone}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone1\` has not been set (${error})`));
    this.driver.triggerOperationModeZone1WithCool(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityOperationModeZone2WithCool(operationModeZone) {
    await this.setCapabilityValue('operation_mode_zone_with_cool.zone2', operationModeZone)
      .then(this.log(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone2\` equals to \`${operationModeZone}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`operation_mode_zone_with_cool.zone2\` has not been set (${error})`));
    this.driver.triggerOperationModeZone2WithCool(this);
    await this.syncDeviceFromData();
  }

  async onCapabilityTargetTemperatureZone1(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone1', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityCoolFlowTemperatureZone1(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone1_flow_cool', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_cool\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_cool\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityHeatFlowTemperatureZone1(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone1_flow_heat', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_heat\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone1_flow_heat\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityTargetTemperatureZone2(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone2', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityCoolFlowTemperatureZone2(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone2_flow_cool', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_cool\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_cool\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityHeatFlowTemperatureZone2(targetTemperature) {
    await this.setCapabilityValue('target_temperature.zone2_flow_heat', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_heat\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.zone2_flow_heat\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }

  async onCapabilityTankWaterTemperature(targetTemperature) {
    await this.setCapabilityValue('target_temperature.tank_water', targetTemperature)
      .then(this.log(`\`${this.getName()}\`: capability \`target_temperature.tank_water\` equals to \`${targetTemperature}\``))
      .catch((error) => this.error(`\`${this.getName()}\`: capability \`target_temperature.tank_water\` has not been set (${error})`));
    await this.syncDeviceFromData();
  }
}

module.exports = MELCloudAtwDevice;
