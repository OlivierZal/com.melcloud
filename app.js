const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudApp extends Homey.App {
  async onInit() {
    this.baseUrl = 'https://app.melcloud.com/Mitsubishi.Wifi.Client';
  }

  async login(username, password) {
    let response;
    if (username && password) {
      const options = {
        uri: `${this.baseUrl}/Login/ClientLogin`,
        json: {
          AppVersion: '1.9.3.0',
          Email: username,
          Password: password,
          Persist: true,
        },
      };
      try {
        this.instanceLog('Login to MELCloud...');
        response = await http.post(options).then((result) => {
          if (result.response.statusCode !== 200) {
            throw new Error(result.response.statusCode);
          }
          this.instanceLog('Login to MELCloud:', result.data);
          if (result.data.ErrorMessage) {
            throw new Error(result.data.ErrorMessage);
          }
          this.homey.settings.set('ContextKey', result.data.LoginData.ContextKey);
          return true;
        });
      } catch (error) {
        if (error instanceof SyntaxError) {
          error.message = 'Not found';
        }
        this.instanceError('Login to MELCloud:', error.message);
      }
    }
    return response ?? false;
  }

  async listDevices(instance) {
    const driver = instance instanceof Homey.Device ? instance.driver : instance;

    let listDevices;
    const options = {
      uri: `${this.baseUrl}/User/ListDevices`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      instance.instanceLog('Searching for devices...');
      listDevices = await http.get(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(result.response.statusCode);
        }
        instance.instanceLog('Searching for devices:', result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        const devices = {};
        result.data.forEach((data) => {
          data.Structure.Devices.forEach((device) => {
            if (driver.deviceType === device.Device.DeviceType) {
              devices[`${device.BuildingID}-${device.DeviceID}`] = device;
            }
          });
          data.Structure.Areas.forEach((area) => {
            area.Devices.forEach((device) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices[`${device.BuildingID}-${device.DeviceID}`] = device;
              }
            });
          });
          data.Structure.Floors.forEach((floor) => {
            floor.Devices.forEach((device) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices[`${device.BuildingID}-${device.DeviceID}`] = device;
              }
            });
            floor.Areas.forEach((area) => {
              area.Devices.forEach((device) => {
                if (driver.deviceType === device.Device.DeviceType) {
                  devices[`${device.BuildingID}-${device.DeviceID}`] = device;
                }
              });
            });
          });
        });
        return devices;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        error.message = 'Not found';
      }
      instance.instanceError('Searching for devices:', error.message);
    }
    return listDevices ?? {};
  }

  async getDevice(device) {
    let resultData;
    const options = {
      uri: `${this.baseUrl}/Device/Get?id=${device.data.id}&buildingID=${device.data.buildingid}`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      device.instanceLog('Syncing from device...');
      resultData = await http.get(options).then(async (result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(result.response.statusCode);
        }
        device.instanceLog('Syncing from device:', result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        error.message = 'Not found';
      }
      device.instanceError('Syncing from device:', error.message);
    }
    return resultData ?? {};
  }

  async setDevice(device, json) {
    let resultData;
    const options = {
      uri: `${this.baseUrl}/Device/Set${device.driver.heatPumpType}`,
      headers: { 'X-MitsContextKey': device.homey.settings.get('ContextKey') },
      json,
    };
    try {
      device.instanceLog('Syncing with device...', json);
      resultData = await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(result.response.statusCode);
        }
        device.instanceLog('Syncing with device:', result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        error.message = 'Not found';
      }
      device.instanceError('Syncing with device:', error.message);
    }
    return resultData ?? {};
  }

  async reportEnergyCost(device, daily) {
    let reportData;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toDate = `${yesterday.toISOString().split('T')[0]}T00:00:00`;

    const options = {
      uri: `${this.baseUrl}/EnergyCost/Report`,
      headers: { 'X-MitsContextKey': device.homey.settings.get('ContextKey') },
      json: {
        DeviceId: device.data.id,
        FromDate: daily ? toDate : '1970-01-01T00:00:00',
        ToDate: toDate,
        UseCurrency: false,
      },
    };
    const period = daily ? 'daily' : 'total';

    try {
      device.instanceLog('Reporting', period, 'energy cost...');
      reportData = await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(result.response.statusCode);
        }
        device.instanceLog('Reporting', period, 'energy cost:', result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        error.message = 'Not found';
      }
      device.instanceError('Reporting', period, 'energy cost:', error.message);
    }
    return reportData ?? {};
  }

  instanceLog(...message) {
    this.log(...message);
  }

  instanceError(...message) {
    this.error(...message);
  }
}

module.exports = MELCloudApp;
