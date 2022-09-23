const Homey = require('homey');
const http = require('http.min');

class MelCloudDevice extends Homey.Device {
  async onAdded() {
    try {
      await this.onInit();
    } catch (error) {
      throw new Error(error);
    }
  }

  onInit() {
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.registerCapabilityListener('forcedhotwater', this.onCapabilityForcedHotWater.bind(this));
    this.registerCapabilityListener('mode_heatpump1', this.onCapabilityMode.bind(this));
    this.getDeviceData(this);

    if (!this.hasCapability('heat_temperature')) {
      this.addCapability('heat_temperature');
    }
    if (!this.hasCapability('cool_temperature')) {
      this.addCapability('cool_temperature');
    }
    if (!this.hasCapability('meter_heatpumpfrequency')) {
      this.addCapability('meter_heatpumpfrequency');
    }
  }

  getDeviceData() {
    try {
      const ContextKey = Homey.ManagerSettings.get('ContextKey');
      const data = this.getData();
      let { zone } = data;
      if (!zone) {
        zone = 1;
      }
      const request = {
        uri: `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
        json: true,
        headers: { 'X-MitsContextKey': ContextKey },
      };
      const driver = this.getDriver();
      http.get(request).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error('No device');
        }
        const settings = this.getSettings();
        const currentMode = settings.operationmode;
        const currentHeatTemperature = settings.heat_temperature;
        const currentColdTemperature = settings.cold_temperature;
        if (zone === 1) {
          this.setSettings({
            heattemperature: result.data.SetHeatFlowTemperatureZone1,
            cooltemperature: result.data.SetCoolFlowTemperatureZone1,
            tanktemperature: result.data.SetTankWaterTemperature,
            ecohotwater: result.data.EcoHotWater,
            operationmode: String(result.data.OperationMode),
            operationmodezone: String(result.data.OperationModeZone1),
          });
          if (result.data.SetTemperatureZone1 < 10) {
            this.setCapabilityValue('target_temperature', 10);
          } else if (result.data.SetTemperatureZone1 > 30) {
            this.setCapabilityValue('target_temperature', 30);
          } else {
            this.setCapabilityValue('target_temperature', result.data.SetTemperatureZone1);
          }
          this.setCapabilityValue('mode_heatpump1', String(result.data.OperationModeZone1));
          this.setCapabilityValue('measure_temperature', result.data.RoomTemperatureZone1);
          this.setCapabilityValue('heat_temperature', result.data.SetHeatFlowTemperatureZone1);
          this.setCapabilityValue('cool_temperature', result.data.SetCoolFlowTemperatureZone1);
          if (currentHeatTemperature !== result.data.SetHeatFlowTemperatureZone1) {
            driver.triggerHotWaterChange(this);
          }
          if (currentColdTemperature !== result.data.SetCoolFlowTemperatureZone1) {
            driver.triggerColdWaterChange(this);
          }
        } else {
          this.setSettings({
            heattemperature: result.data.SetHeatFlowTemperatureZone2,
            cooltemperature: result.data.SetCoolFlowTemperatureZone2,
            tanktemperature: result.data.SetTankWaterTemperature,
            ecohotwater: result.data.EcoHotWater,
            operationmode: String(result.data.OperationMode),
            operationmodezone: String(result.data.OperationModeZone2),
          });
          if (result.data.SetTemperatureZone2 < 10) {
            this.setCapabilityValue('target_temperature', 10);
          } else if (result.data.SetTemperatureZone2 > 30) {
            this.setCapabilityValue('target_temperature', 30);
          } else {
            this.setCapabilityValue('target_temperature', result.data.SetTemperatureZone2);
          }
          this.setCapabilityValue('mode_heatpump1', String(result.data.OperationModeZone2));
          this.setCapabilityValue('measure_temperature', result.data.RoomTemperatureZone2);
          this.setCapabilityValue('heat_temperature', result.data.SetHeatFlowTemperatureZone2);
          this.setCapabilityValue('cool_temperature', result.data.SetCoolFlowTemperatureZone2);
          if (currentHeatTemperature !== result.data.SetHeatFlowTemperatureZone2) {
            driver.triggerHotWaterChange(this);
          }
          if (currentColdTemperature !== result.data.SetCoolFlowTemperatureZone2) {
            driver.triggerColdWaterChange(this);
          }
        }

        this.setCapabilityValue('outside_temperature', result.data.OutdoorTemperature);
        if (this.hasCapability('onoff')) {
          this.setCapabilityValue('onoff', result.data.Power);
        }
        const currentForced = this.getCapabilityValue('forcedhotwater');
        if (currentForced !== result.data.ForcedHotWaterMode) {
          driver.triggerForcedHotWaterChange(this);
        }

        if (currentMode !== result.data.OperationMode) {
          driver.triggerOperationModeChange(this);
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
        this.setCapabilityValue('measure_OperationMode', operationMode);
        this.setCapabilityValue('forcedhotwater', result.data.ForcedHotWaterMode);
        this.setCapabilityValue('watertank_temperature', result.data.TankWaterTemperature);
      });

      const deviceList = driver.getDevices();
      deviceList.forEach((device) => {
        if (device.getData().id === data.id) {
          this.setCapabilityValue('alarm_DefrostMode', device.Device.DefrostMode === 2);
          this.setCapabilityValue('alarm_BoosterHeater1', device.Device.BoosterHeater1Status);
          this.setCapabilityValue('alarm_BoosterHeater2', device.Device.BoosterHeater2Status);
          this.setCapabilityValue('alarm_BoosterHeater2Plus', device.Device.BoosterHeater2PlusStatus);
          this.setCapabilityValue('alarm_ImmersionHeater', device.Device.ImmersionHeaterStatus);
          this.setCapabilityValue('cold_temperature', device.Device.ReturnTemperature);
          this.setCapabilityValue('hot_temperature', device.Device.FlowTemperature);
          this.setCapabilityValue('meter_heatpumpfrequency', device.Device.HeatPumpFrequency);
        }
      });

      clearTimeout(this.syncTimeout);
      const updateInterval = this.getSettings().interval;
      const interval = 1000 * 60 * updateInterval;
      this.syncTimeout = setTimeout(this.getDeviceData.bind(this), (interval));
    } catch (error) {
      throw new Error(error);
    }
  }

  async updateCapabilityValues() {
    try {
      const ContextKey = Homey.ManagerSettings.get('ContextKey');
      const data = this.getData();
      const { zone } = data;
      const settings = await this.getSettings();
      let power;
      if (this.hasCapability('onoff')) {
        power = this.getCapabilityValue('onoff');
      } else {
        power = true;
      }

      let request;
      if (zone === '1') {
        request = {
          uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
          headers: {
            'X-MitsContextKey': ContextKey,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          json: {
            DeviceID: data.id,
            EffectiveFlags: 281483566710825,
            HasPendingCommand: 'true',
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
      } else {
        request = {
          uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAtw',
          headers: {
            'X-MitsContextKey': ContextKey,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          json: {
            DeviceID: data.id,
            EffectiveFlags: 281509336515113,
            HasPendingCommand: 'true',
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
      }
      await http.post(request).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error('No device');
        }
      });
      this.syncTimeout = setTimeout(this.getDeviceData.bind(this), (1 * 60 * 1000));
    } catch (error) {
      throw new Error(error);
    }
  }

  async onSettings(oldSettingsObj, newSettingsObj) {
    try {
      const mode = await this.getCapabilityValue('mode_heatpump1');
      if (mode !== newSettingsObj.operationmodezone) {
        await this.setCapabilityValue('mode_heatpump1', newSettingsObj.operationmodezone);
      }
      await setTimeout(() => this.alwaysOn(), 1000);
      this.syncTimeout = setTimeout(this.updateCapabilityValues.bind(this), (2000));
    } catch (error) {
      throw new Error(error);
    }
  }

  async alwaysOn() {
    try {
      const settings = this.getSettings();
      if (settings.alwayson && this.hasCapability('onoff')) {
        this.removeCapability('onoff');
      } else if (!settings.alwayson && !this.hasCapability('onoff')) {
        this.addCapability('onoff');
      }
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityOnOff(value) {
    try {
      if (this.hasCapability('onoff')) {
        await this.setCapabilityValue('onoff', value);
      }
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityMode(value) {
    try {
      await this.setCapabilityValue('mode_heatpump1', value);
      const driver = this.getDriver();
      driver.triggerModeChange(this);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityOperationMode(value) {
    try {
      await this.setSettings({
        operationmode: String(value),
      });
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityForcedHotWater(value) {
    try {
      await this.setCapabilityValue('forcedhotwater', value);
      const driver = this.getDriver();
      driver.triggerForcedHotWaterChange(this);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityEcoHotWater(value) {
    try {
      await this.setSettings({
        ecohotwater: value,
      });
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilitySetTemperature(value) {
    try {
      await this.setCapabilityValue('target_temperature', value);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }
}

module.exports = MelCloudDevice;
