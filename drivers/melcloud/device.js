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
    await this.onInit();
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
      await this.setCapabilityValue('target_temperature', 4).catch(this.error);
    } else if (response.data.SetTemperature > 35) {
      await this.setCapabilityValue('target_temperature', 35).catch(this.error);
    } else {
      await this.setCapabilityValue('target_temperature', response.data.SetTemperature).catch(this.error);
    }
    await this.setCapabilityValue('measure_temperature', response.data.RoomTemperature).catch(this.error);
    await this.setCapabilityValue('onoff', response.data.Power).catch(this.error);
    if (!this.getCapabilityValue('thermostat_mode')) {
      await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
    }

    const mode = Value2Mode(response.data.OperationMode);
    if (mode !== this.getCapabilityValue('mode_capability')) {
      this.driver.triggerThermostatModeChange(this);
    }

    await this.setCapabilityValue('mode_capability', mode).catch(this.error);
    await this.setTermostatModeValue(response.data.Power, mode);

    if (response.data.SetFanSpeed !== this.getCapabilityValue('fan_power')) {
      this.driver.triggerFanSpeedChange(this);
    }
    await this.setCapabilityValue('fan_power', response.data.SetFanSpeed).catch(this.error);
    const vertical = Value2Vertical(response.data.VaneVertical);
    if (vertical !== this.getCapabilityValue('vertical')) {
      this.driver.triggerVerticalSwingChange(this);
    }
    await this.setCapabilityValue('vertical', vertical).catch(this.error);
    const horizontal = Value2Horizontal(response.data.VaneHorizontal);
    if (horizontal !== this.getCapabilityValue('horizontal')) {
      this.driver.triggerHorizontalSwingChange(this);
    }
    await this.setCapabilityValue('horizontal', horizontal).catch(this.error);

    clearTimeout(this.syncTimeout);
    const updateInterval = this.getSettings().interval;
    this.syncTimeout = setTimeout(this.getDeviceData.bind(this), updateInterval * 60000);
  }

  async updateCapabilityValues() {
    const ContextKey = this.homey.settings.get('ContextKey');
    const data = this.getData();
    const mode = Mode2Value(this.getCapabilityValue('mode_capability'));
    const vertical = Vertical2Value(this.getCapabilityValue('vertical'));
    const horizontal = Horizontal2Value(this.getCapabilityValue('horizontal'));
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
  }

  async onCapabilityOnOff(onoff) {
    await this.setCapabilityValue('onoff', onoff).catch(this.error);
    if (onoff) {
      await this.setTermostatModeValue(onoff, this.getCapabilityValue('mode_capability'));
    } else {
      await this.setCapabilityValue('thermostat_mode', 'off').catch(this.error);
    }
    this.updateCapabilityValues();
  }

  async onCapabilitySetTemperature(value) {
    await this.setCapabilityValue('target_temperature', value).catch(this.error);
    this.updateCapabilityValues();
  }

  async onCapabilitySetMode(mode) {
    await this.setCapabilityValue('mode_capability', mode).catch(this.error);
    this.driver.triggerThermostatModeChange(this);
    await this.setTermostatModeValue(this.getCapabilityValue('onoff'), mode);
    this.updateCapabilityValues();
  }

  async onCapabilitySetthermostat_mode(value) {
    await this.Value2ThermostatMode(value);
    this.updateCapabilityValues();
  }

  async onCapabilityVerticalSet(value) {
    await this.setCapabilityValue('vertical', value).catch(this.error);
    this.driver.triggerVerticalSwingChange(this);
    this.updateCapabilityValues();
  }

  async onCapabilityHorizontalSet(value) {
    await this.setCapabilityValue('horizontal', value).catch(this.error);
    this.driver.triggerHorizontalSwingChange(this);
    this.updateCapabilityValues();
  }

  async onCapabilityFanSet(value) {
    await this.setCapabilityValue('fan_power', value).catch(this.error);
    this.driver.triggerFanSpeedChange(this);
    this.updateCapabilityValues();
  }

  async setTermostatModeValue(onoff, mode) {
    let thermostatMode;
    if (mode === 'cool' && onoff) {
      thermostatMode = 'cool';
      await this.setCapabilityValue('onoff', true).catch(this.error);
    } else if (mode === 'cool' && !onoff) {
      thermostatMode = 'off';
      await this.setCapabilityValue('onoff', false).catch(this.error);
    } else if (mode === 'off') {
      thermostatMode = 'off';
      await this.setCapabilityValue('onoff', false).catch(this.error);
    } else if (mode === 'heat' && onoff) {
      thermostatMode = 'heat';
      await this.setCapabilityValue('onoff', true).catch(this.error);
    } else if (mode === 'heat' && !onoff) {
      thermostatMode = 'off';
      await this.setCapabilityValue('onoff', false).catch(this.error);
    } else if (onoff) {
      thermostatMode = 'auto';
      await this.setCapabilityValue('onoff', true).catch(this.error);
    } else {
      thermostatMode = 'off';
      await this.setCapabilityValue('onoff', false).catch(this.error);
    }
    if (mode !== 'fan' && mode !== 'dry') {
      await this.setCapabilityValue('thermostat_mode', thermostatMode).catch(this.error);
    }
    await this.setCapabilityValue('mode_capability', mode).catch(this.error);
    return thermostatMode;
  }

  async Value2ThermostatMode(value) {
    await this.setCapabilityValue('thermostat_mode', value).catch(this.error);
    if (value === 'off') {
      await this.setCapabilityValue('onoff', false).catch(this.error);
    } else if (value === 'heat') {
      await this.setCapabilityValue('onoff', true).catch(this.error);
      await this.setCapabilityValue('mode_capability', 'heat').catch(this.error);
    } else if (value === 'cool') {
      await this.setCapabilityValue('onoff', true).catch(this.error);
      await this.setCapabilityValue('mode_capability', 'cool').catch(this.error);
    } else if (value === 'auto') {
      await this.setCapabilityValue('onoff', true).catch(this.error);
      await this.setCapabilityValue('mode_capability', 'auto').catch(this.error);
    }
  }
}

module.exports = MelCloudDevice;
