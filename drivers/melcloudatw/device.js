const Homey = require('homey');
const http = require('http.min');

class MelCloudDeviceAtw extends Homey.Device {
  async onAdded() {
    await this.onInit();
  }

  async onInit() {
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.registerCapabilityListener('forcedhotwater', this.onCapabilityForcedHotWater.bind(this));
    this.registerCapabilityListener('mode_heatpump1', this.onCapabilityMode.bind(this));
    await this.getDeviceData();
  }

  async getDeviceData() {
    if (!this.hasCapability('heat_temperature')) {
      this.addCapability('heat_temperature');
    }
    if (!this.hasCapability('cool_temperature')) {
      this.addCapability('cool_temperature');
    }
    if (!this.hasCapability('meter_heatpumpfrequency')) {
      this.addCapability('meter_heatpumpfrequency');
    }

    const ContextKey = this.homey.settings.get('ContextKey');
    const data = this.getData();
    const request = {
      uri: `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
      headers: { 'X-MitsContextKey': ContextKey },
      json: true,
    };
    await http.get(request).then((result) => {
      if (result.response.statusCode !== 200) {
        throw new Error('No device');
      }
      const settings = this.getSettings();
      const currentMode = settings.operationmode;
      const currentHeatTemperature = settings.heat_temperature;
      const currentCoolTemperature = settings.cool_temperature;
      if (data.zone === 2) {
        this.setSettings({
          heattemperature: result.data.SetHeatFlowTemperatureZone2,
          cooltemperature: result.data.SetCoolFlowTemperatureZone2,
          tanktemperature: result.data.SetTankWaterTemperature,
          ecohotwater: result.data.EcoHotWater,
          operationmode: String(result.data.OperationMode),
          operationmodezone: String(result.data.OperationModeZone2),
        });
        if (result.data.SetTemperatureZone2 < 10) {
          this.setCapabilityValue('target_temperature', 10).catch(this.error);
        } else if (result.data.SetTemperatureZone2 > 30) {
          this.setCapabilityValue('target_temperature', 30).catch(this.error);
        } else {
          this.setCapabilityValue('target_temperature', result.data.SetTemperatureZone2).catch(this.error);
        }
        this.setCapabilityValue('mode_heatpump1', String(result.data.OperationModeZone2)).catch(this.error);
        this.setCapabilityValue('measure_temperature', result.data.RoomTemperatureZone2).catch(this.error);
        this.setCapabilityValue('heat_temperature', result.data.SetHeatFlowTemperatureZone2).catch(this.error);
        this.setCapabilityValue('cool_temperature', result.data.SetCoolFlowTemperatureZone2).catch(this.error);
        if (currentHeatTemperature !== result.data.SetHeatFlowTemperatureZone2) {
          this.driver.triggerHotWaterChange(this);
        }
        if (currentCoolTemperature !== result.data.SetCoolFlowTemperatureZone2) {
          this.driver.triggerColdWaterChange(this);
        }
      } else {
        this.setSettings({
          heattemperature: result.data.SetHeatFlowTemperatureZone1,
          cooltemperature: result.data.SetCoolFlowTemperatureZone1,
          tanktemperature: result.data.SetTankWaterTemperature,
          ecohotwater: result.data.EcoHotWater === true,
          operationmode: String(result.data.OperationMode),
          operationmodezone: String(result.data.OperationModeZone1),
        });
        if (result.data.SetTemperatureZone1 < 10) {
          this.setCapabilityValue('target_temperature', 10).catch(this.error);
        } else if (result.data.SetTemperatureZone1 > 30) {
          this.setCapabilityValue('target_temperature', 30).catch(this.error);
        } else {
          this.setCapabilityValue('target_temperature', result.data.SetTemperatureZone1).catch(this.error);
        }
        this.setCapabilityValue('mode_heatpump1', String(result.data.OperationModeZone1)).catch(this.error);
        this.setCapabilityValue('measure_temperature', result.data.RoomTemperatureZone1).catch(this.error);
        this.setCapabilityValue('heat_temperature', result.data.SetHeatFlowTemperatureZone1).catch(this.error);
        this.setCapabilityValue('cool_temperature', result.data.SetCoolFlowTemperatureZone1).catch(this.error);
        if (currentHeatTemperature !== result.data.SetHeatFlowTemperatureZone1) {
          this.driver.triggerHotWaterChange(this);
        }
        if (currentCoolTemperature !== result.data.SetCoolFlowTemperatureZone1) {
          this.driver.triggerColdWaterChange(this);
        }
      }

      this.setCapabilityValue('outside_temperature', result.data.OutdoorTemperature).catch(this.error);
      if (this.hasCapability('onoff')) {
        this.setCapabilityValue('onoff', result.data.Power).catch(this.error);
      }
      const currentForced = this.getCapabilityValue('forcedhotwater');
      if (currentForced !== result.data.ForcedHotWaterMode) {
        this.driver.triggerForcedHotWaterChange(this);
      }

      if (currentMode !== result.data.OperationMode) {
        this.driver.triggerOperationModeChange(this);
      }
      let operationMode;
      switch (result.data.OperationMode) {
        case 1:
          operationMode = 'DHW-Heating';
          break;
        case 2:
          operationMode = 'Heating';
          break;
        case 3:
          operationMode = 'Cooling';
          break;
        case 4:
          operationMode = 'Defrost';
          break;
        case 5:
          operationMode = 'Standby';
          break;
        case 6:
          operationMode = 'Legionella';
          break;
        default:
          operationMode = 'Off';
      }
      this.setCapabilityValue('measure_operationmode', operationMode).catch(this.error);
      this.setCapabilityValue('forcedhotwater', result.data.ForcedHotWaterMode).catch(this.error);
      this.setCapabilityValue('watertank_temperature', result.data.TankWaterTemperature).catch(this.error);
    });

    const deviceList = await this.driver.discoverDevices();
    deviceList.forEach((device) => {
      if (device.DeviceID === data.id) {
        this.setCapabilityValue('alarm_defrostmode', device.Device.DefrostMode === 2).catch(this.error);
        this.setCapabilityValue('alarm_boosterheater1', device.Device.BoosterHeater1Status).catch(this.error);
        this.setCapabilityValue('alarm_boosterheater2', device.Device.BoosterHeater2Status).catch(this.error);
        this.setCapabilityValue('alarm_boosterheater2plus', device.Device.BoosterHeater2PlusStatus).catch(this.error);
        this.setCapabilityValue('alarm_immersionheater', device.Device.ImmersionHeaterStatus).catch(this.error);
        this.setCapabilityValue('cold_temperature', device.Device.ReturnTemperature).catch(this.error);
        this.setCapabilityValue('hot_temperature', device.Device.FlowTemperature).catch(this.error);
        this.setCapabilityValue('meter_heatpumpfrequency', device.Device.HeatPumpFrequency).catch(this.error);
      }
    });

    clearTimeout(this.syncTimeout);
    const updateInterval = this.getSettings().interval;
    this.syncTimeout = setTimeout(this.getDeviceData.bind(this), updateInterval * 60000);
  }

  async updateCapabilityValues() {
    const ContextKey = this.homey.settings.get('ContextKey');
    const data = this.getData();
    const settings = this.getSettings();
    let power;
    if (this.hasCapability('onoff')) {
      power = this.getCapabilityValue('onoff');
    } else {
      power = true;
    }

    let request;
    if (data.zone === 2) {
      request = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
        headers: { 'X-MitsContextKey': ContextKey },
        json: {
          DeviceID: data.id,
          EffectiveFlags: 0x1000800010229,
          HasPendingCommand: true,
          Power: power,
          SetTemperatureZone2: this.getCapabilityValue('target_temperature'),
          ForcedHotWaterMode: this.getCapabilityValue('forcedhotwater'),
          SetHeatFlowTemperatureZone2: settings.heattemperature,
          SetCoolFlowTemperatureZone2: settings.cooltemperature,
          SetTankWaterTemperature: settings.tanktemperature,
          EcoHotWater: settings.ecohotwater,
          OperationModeZone2: this.getCapabilityValue('mode_heatpump1'),
          OperationMode: settings.operationmode,
        },
      };
    } else {
      request = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
        headers: { 'X-MitsContextKey': ContextKey },
        json: {
          DeviceID: data.id,
          EffectiveFlags: 0x1000200010029,
          HasPendingCommand: true,
          Power: power,
          SetTemperatureZone1: this.getCapabilityValue('target_temperature'),
          ForcedHotWaterMode: this.getCapabilityValue('forcedhotwater'),
          SetHeatFlowTemperatureZone1: settings.heattemperature,
          SetCoolFlowTemperatureZone1: settings.cooltemperature,
          SetTankWaterTemperature: settings.tanktemperature,
          EcoHotWater: settings.ecohotwater,
          OperationModeZone1: this.getCapabilityValue('mode_heatpump1'),
          OperationMode: settings.operationmode,
        },
      };
    }
    await http.post(request).then((result) => {
      if (result.response.statusCode !== 200) {
        throw new Error('No device');
      }
    });
    this.syncTimeout = setTimeout(this.getDeviceData.bind(this), 60000);
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    if (changedKeys.includes('operationmodezone')) {
      await this.setCapabilityValue('mode_heatpump1', newSettings.operationmodezone).catch(this.error);
    }
    await setTimeout(() => this.alwaysOn(), 1000);
    this.syncTimeout = setTimeout(this.updateCapabilityValues.bind(this), 2000);
  }

  async alwaysOn() {
    const settings = this.getSettings();
    if (settings.alwayson && this.hasCapability('onoff')) {
      this.removeCapability('onoff');
    } else if (!settings.alwayson && !this.hasCapability('onoff')) {
      this.addCapability('onoff');
    }
  }

  async onCapabilityOnOff(value) {
    if (this.hasCapability('onoff')) {
      await this.setCapabilityValue('onoff', value).catch(this.error);
    }
    this.updateCapabilityValues();
  }

  async onCapabilityMode(value) {
    await this.setCapabilityValue('mode_heatpump1', value).catch(this.error);
    this.driver.triggerModeChange(this);
    this.updateCapabilityValues();
  }

  async onCapabilityOperationMode(value) {
    await this.setSettings({
      operationmode: String(value),
    });
    this.updateCapabilityValues();
  }

  async onCapabilityForcedHotWater(value) {
    await this.setCapabilityValue('forcedhotwater', value === true || value === 'true').catch(this.error);
    this.driver.triggerForcedHotWaterChange(this);
    this.updateCapabilityValues();
  }

  async onCapabilityEcoHotWater(value) {
    await this.setSettings({
      ecohotwater: value,
    });
    this.updateCapabilityValues();
  }

  async onCapabilitySetTemperature(value) {
    await this.setCapabilityValue('target_temperature', value).catch(this.error);
    this.updateCapabilityValues();
  }
}

module.exports = MelCloudDeviceAtw;
