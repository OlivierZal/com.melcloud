const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudDriverMixin extends Homey.Driver {
  async logIn(username, password) {
    let response = false;
    if (username && password) {
      const options = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
        json: {
          AppVersion: '1.9.3.0',
          Email: username,
          Password: password,
          Persist: true,
        },
      };
      try {
        this.log('Login to MELCloud...');
        response = await http.post(options).then((result) => {
          if (result.response.statusCode !== 200) {
            throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
          }
          this.log(result.data);
          if (result.data.ErrorMessage) {
            throw new Error(result.data.ErrorMessage);
          }
          this.homey.settings.set('ContextKey', result.data.LoginData.ContextKey);
          return true;
        });
        this.log('Login to MELCloud: authentication has been successfully completed');
      } catch (error) {
        this.error(`Login to MELCloud: a problem occurred (${error})`);
      }
    }
    return response;
  }

  async discoverDevices() {
    const options = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices',
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    let deviceList = [];
    try {
      this.log('Searching for devices...');
      deviceList = await http.get(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        const devices = [];
        result.data.forEach((data) => {
          data.Structure.Devices.forEach((device) => {
            if (this.deviceType === device.Device.DeviceType) {
              devices.push(device);
            }
          });
          data.Structure.Areas.forEach((area) => {
            area.Devices.forEach((device) => {
              if (this.deviceType === device.Device.DeviceType) {
                devices.push(device);
              }
            });
          });
          data.Structure.Floors.forEach((floor) => {
            floor.Devices.forEach((device) => {
              if (this.deviceType === device.Device.DeviceType) {
                devices.push(device);
              }
            });
            floor.Areas.forEach((area) => {
              area.Devices.forEach((device) => {
                if (this.deviceType === device.Device.DeviceType) {
                  devices.push(device);
                }
              });
            });
          });
        });
        return devices;
      });
      this.log('Searching for devices: search has been successfully completed');
    } catch (error) {
      this.error(`Searching for devices: a problem occurred (${error})`);
    }
    return deviceList;
  }

  async listDevices() {
    const deviceList = await this.discoverDevices();
    const devices = deviceList.map((device) => {
      const deviceInfo = {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID,
        },
        capabilities: [],
      };
      if (device.Device.DeviceType === 1) {
        deviceInfo.data.canCool = device.Device.CanCool;
        deviceInfo.data.hasZone2 = device.Device.HasZone2;
        const atwCapabilities = [
          'alarm_generic.booster_heater1',
          'alarm_generic.booster_heater2',
          'alarm_generic.booster_heater2_plus',
          'alarm_generic.defrost_mode',
          'alarm_water.immersion_heater',
          'measure_power.daily_co_p',
          'measure_power.daily_consumed',
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
          deviceInfo.capabilities.push(capability);
        });
        if (device.Device.CanCool) {
          const coolAtwCapabilities = [
            'operation_mode_zone_with_cool.zone1',
            'target_temperature.zone1_flow_cool',
          ];
          coolAtwCapabilities.forEach((capability) => {
            deviceInfo.capabilities.push(capability);
          });
        } else {
          deviceInfo.capabilities.push('operation_mode_zone.zone1');
        }
        if (device.Device.HasZone2) {
          const zone2AtwCapabilities = [
            'measure_temperature.zone2',
            'target_temperature.zone2',
            'target_temperature.zone2_flow_heat',
          ];
          zone2AtwCapabilities.forEach((capability) => {
            deviceInfo.capabilities.push(capability);
          });
          if (device.Device.CanCool) {
            const coolZone2AtwCapabilities = [
              'operation_mode_zone_with_cool.zone2',
              'target_temperature.zone2_flow_cool',
            ];
            coolZone2AtwCapabilities.forEach((capability) => {
              deviceInfo.capabilities.push(capability);
            });
          } else {
            deviceInfo.capabilities.push('operation_mode_zone.zone2');
          }
        }
      } else if (device.Device.DeviceType === 0) {
        const ataCapabilities = [
          'fan_power',
          'measure_power.daily_consumed',
          'measure_power.total_consumed',
          'measure_temperature',
          'onoff',
          'operation_mode',
          'target_temperature',
          'vertical',
          'horizontal',
          'thermostat_mode',
        ];
        ataCapabilities.forEach((capability) => {
          deviceInfo.capabilities.push(capability);
        });
      }
      return deviceInfo;
    });
    return devices;
  }

  onPair(session) {
    session.setHandler('login', async (data) => this.logIn(data.username, data.password));
    session.setHandler('list_devices', async () => this.listDevices());
  }
}

module.exports = MELCloudDriverMixin;
