const Homey = require('homey');
const http = require('http.min');

function Mode2Value(value) {
  let mode;
  if (value === 'heat') {
    mode = 1;
  } else if (value === 'cool') {
    mode = 3;
  } else if (value === 'auto') {
    mode = 8;
  } else if (value === 'off') {
    mode = 0;
  } else if (value === 'fan') {
    mode = 7;
  } else if (value === 'dry') {
    mode = 2;
  }
  return mode;
}

function Value2Mode(mode) {
  let value;
  if (mode === 0) {
    value = 'off';
  } else if (mode === 1) {
    value = 'heat';
  } else if (mode === 2) {
    value = 'dry';
  } else if (mode === 3) {
    value = 'cool';
  } else if (mode === 7) {
    value = 'fan';
  } else if (mode === 8) {
    value = 'auto';
  }
  return value;
}

function Vertical2Value(value) {
  let vertical;
  if (value === 'auto') {
    vertical = 0;
  } else if (value === 'top') {
    vertical = 1;
  } else if (value === 'middletop') {
    vertical = 2;
  } else if (value === 'middle') {
    vertical = 3;
  } else if (value === 'middlebottom') {
    vertical = 4;
  } else if (value === 'bottom') {
    vertical = 5;
  } else if (value === 'swing') {
    vertical = 7;
  }
  return vertical;
}

function Value2Vertical(vertical) {
  let value;
  if (vertical === 0) {
    value = 'auto';
  } else if (vertical === 1) {
    value = 'top';
  } else if (vertical === 2) {
    value = 'middletop';
  } else if (vertical === 3) {
    value = 'middle';
  } else if (vertical === 4) {
    value = 'middlebottom';
  } else if (vertical === 5) {
    value = 'bottom';
  } else if (vertical === 7) {
    value = 'swing';
  }
  return value;
}

function Horizontal2Value(value) {
  let horizontal;
  if (value === 'auto') {
    horizontal = 0;
  } else if (value === 'left') {
    horizontal = 1;
  } else if (value === 'middleleft') {
    horizontal = 2;
  } else if (value === 'middle') {
    horizontal = 3;
  } else if (value === 'middleright') {
    horizontal = 4;
  } else if (value === 'right') {
    horizontal = 5;
  } else if (value === 'split') {
    horizontal = 8;
  } else if (value === 'swing') {
    horizontal = 12;
  }
  return horizontal;
}

function Value2Horizontal(horizontal) {
  let value;
  if (horizontal === 0) {
    value = 'auto';
  } else if (horizontal === 1) {
    value = 'left';
  } else if (horizontal === 2) {
    value = 'middleleft';
  } else if (horizontal === 3) {
    value = 'middle';
  } else if (horizontal === 4) {
    value = 'middleright';
  } else if (horizontal === 5) {
    value = 'right';
  } else if (horizontal === 8) {
    value = 'split';
  } else if (horizontal === 12) {
    value = 'swing';
  }
  return value;
}

class MelCloudDevice extends Homey.Device {
  async onAdded() {
    try {
      await this.onInit();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onInit() {
    this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
    this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
    this.registerCapabilityListener('mode_capability', this.onCapabilitySetMode.bind(this));
    this.registerCapabilityListener('thermostat_mode', this.onCapabilitySetthermostat_mode.bind(this));
    this.registerCapabilityListener('fan_power', this.onCapabilityFanSet.bind(this));
    this.registerCapabilityListener('vertical', this.onCapabilityVerticalSet.bind(this));
    this.registerCapabilityListener('horizontal', this.onCapabilityHorizontalSet.bind(this));
    await this.getDeviceData();
  }

  async getDeviceData() {
    try {
      const ContextKey = this.homey.settings.get('ContextKey');
      const data = this.getData();
      const request = {
        uri: `https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
        json: true,
        headers: { 'X-MitsContextKey': ContextKey },
      };
      const response = await http.get(request).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error('No device');
        }
        return result;
      });

      if (response.data.SetTemperature < 4) {
        this.setCapabilityValue('target_temperature', 4);
      } else if (response.data.SetTemperature > 35) {
        this.setCapabilityValue('target_temperature', 35);
      } else {
        this.setCapabilityValue('target_temperature', response.data.SetTemperature);
      }
      this.setCapabilityValue('measure_temperature', response.data.RoomTemperature);
      await this.setCapabilityValue('onoff', response.data.Power);
      if (!this.getCapabilityValue('thermostat_mode')) {
        this.setCapabilityValue('thermostat_mode', 'off');
      }

      const mode = await Value2Mode(response.data.OperationMode);
      if (mode !== this.getCapabilityValue('mode_capability')) {
        this.driver.triggerThermostatModeChange(this);
      }

      await this.setCapabilityValue('mode_capability', mode);
      await this.setTermostatModeValue(response.data.Power, mode);

      if (response.data.SetFanSpeed !== this.getCapabilityValue('fan_power')) {
        this.driver.triggerFanSpeedChange(this);
      }
      this.setCapabilityValue('fan_power', response.data.SetFanSpeed);
      const vertical = await Value2Vertical(response.data.VaneVertical);
      if (vertical !== this.getCapabilityValue('vertical')) {
        this.driver.triggerVerticalSwingChange(this);
      }
      this.setCapabilityValue('vertical', vertical);
      const horizontal = await Value2Horizontal(response.data.VaneHorizontal);
      if (horizontal !== this.getCapabilityValue('horizontal')) {
        this.driver.triggerHorizontalSwingChange(this);
      }
      this.setCapabilityValue('horizontal', horizontal);

      clearTimeout(this.syncTimeout);
      const updateInterval = this.getSettings().interval;
      this.syncTimeout = setTimeout(this.getDeviceData.bind(this), updateInterval * 60000);
    } catch (error) {
      throw new Error(error);
    }
  }

  async updateCapabilityValues() {
    try {
      const ContextKey = this.homey.settings.get('ContextKey');
      const data = this.getData();
      const mode = await Mode2Value(this.getCapabilityValue('mode_capability'));
      const vertical = await Vertical2Value(this.getCapabilityValue('vertical'));
      const horizontal = await Horizontal2Value(this.getCapabilityValue('horizontal'));
      const request = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta',
        headers: { 'X-MitsContextKey': ContextKey },
        json: {
          DeviceID: data.id,
          EffectiveFlags: 0x11F,
          HasPendingCommand: true,
          Power: this.getCapabilityValue('onoff'),
          SetTemperature: this.getCapabilityValue('target_temperature'),
          OperationMode: mode,
          SetFanSpeed: this.getCapabilityValue('fan_power'),
          VaneVertical: vertical,
          VaneHorizontal: horizontal,
        },
      };
      await http.post(request).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error('No device');
        }
      });
      this.syncTimeout = setTimeout(this.getDeviceData.bind(this), 2 * 60000);
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityOnOff(onoff) {
    try {
      await this.setCapabilityValue('onoff', onoff);
      const mode = await this.getCapabilityValue('mode_capability');
      if (onoff) {
        await this.setTermostatModeValue(onoff, mode);
      } else {
        this.setCapabilityValue('thermostat_mode', 'off');
      }
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

  async onCapabilitySetMode(mode) {
    try {
      await this.setCapabilityValue('mode_capability', mode);
      const onoff = await this.getCapabilityValue('onoff');
      this.driver.triggerThermostatModeChange(this);
      await this.setTermostatModeValue(onoff, mode);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilitySetthermostat_mode(value) {
    try {
      await this.Value2ThermostatMode(value);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityVerticalSet(value) {
    try {
      await this.setCapabilityValue('vertical', value);
      this.driver.triggerVerticalSwingChange(this);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityHorizontalSet(value) {
    try {
      await this.setCapabilityValue('horizontal', value);
      this.driver.triggerHorizontalSwingChange(this);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async onCapabilityFanSet(value) {
    try {
      await this.setCapabilityValue('fan_power', value);
      this.driver.triggerFanSpeedChange(this);
      this.updateCapabilityValues();
    } catch (error) {
      throw new Error(error);
    }
  }

  async setTermostatModeValue(onoff, mode) {
    try {
      let thermostatMode;
      if (mode === 'cool' && onoff) {
        thermostatMode = 'cool';
        await this.setCapabilityValue('onoff', true);
      } else if (mode === 'cool' && !onoff) {
        thermostatMode = 'off';
        await this.setCapabilityValue('onoff', false);
      } else if (mode === 'off') {
        thermostatMode = 'off';
        await this.setCapabilityValue('onoff', false);
      } else if (mode === 'heat' && onoff) {
        thermostatMode = 'heat';
        await this.setCapabilityValue('onoff', true);
      } else if (mode === 'heat' && !onoff) {
        thermostatMode = 'off';
        await this.setCapabilityValue('onoff', false);
      } else if (onoff) {
        thermostatMode = 'auto';
        await this.setCapabilityValue('onoff', true);
      } else {
        thermostatMode = 'off';
        await this.setCapabilityValue('onoff', false);
      }
      if (mode !== 'fan' && mode !== 'dry') {
        await this.setCapabilityValue('thermostat_mode', thermostatMode);
      }
      await this.setCapabilityValue('mode_capability', mode);
      return thermostatMode;
    } catch (error) {
      throw new Error(error);
    }
  }

  async Value2ThermostatMode(value) {
    try {
      await this.setCapabilityValue('thermostat_mode', value);
      if (value === 'off') {
        await this.setCapabilityValue('onoff', false);
      } else if (value === 'heat') {
        await this.setCapabilityValue('onoff', true);
        await this.setCapabilityValue('mode_capability', 'heat');
      } else if (value === 'cool') {
        await this.setCapabilityValue('onoff', true);
        await this.setCapabilityValue('mode_capability', 'cool');
      } else if (value === 'auto') {
        await this.setCapabilityValue('onoff', true);
        await this.setCapabilityValue('mode_capability', 'auto');
      }
      return;
    } catch (error) {
      throw new Error(error);
    }
  }
}

module.exports = MelCloudDevice;
