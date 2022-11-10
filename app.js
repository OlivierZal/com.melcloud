const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const axios = require('axios');

class MELCloudApp extends Homey.App {
  onInit() {
    this.baseUrl = 'https://app.melcloud.com/Mitsubishi.Wifi.Client';
    this.contextKey = this.homey.settings.get('ContextKey');

    this.homey.setInterval(() => {
      this.login(this.homey.settings.get('username'), this.homey.settings.get('password'));
    }, 24 * 60 * 60 * 1000);
  }

  async login(username, password) {
    let login = false;
    if (username && password) {
      const url = `${this.baseUrl}/Login/ClientLogin`;
      const data = {
        AppVersion: '1.9.3.0',
        Email: username,
        Password: password,
        Persist: true,
      };

      try {
        this.instanceLog('Login to MELCloud...');
        login = await axios.post(url, data).then((response) => {
          this.instanceLog('Login to MELCloud:', response.data);
          if (response.data.LoginData) {
            this.homey.settings.set('ContextKey', response.data.LoginData.ContextKey);
            return true;
          }
          return false;
        });
      } catch (error) {
        this.instanceError('Login to MELCloud:', error.message);
      }
    }
    if (login) {
      this.homey.settings.set('username', username);
      this.homey.settings.set('password', password);
    }
    return login;
  }

  async listDevices(instance) {
    const driver = instance instanceof Homey.Device ? instance.driver : instance;

    const url = `${this.baseUrl}/User/ListDevices`;
    const config = { headers: { 'X-MitsContextKey': this.contextKey } };

    let listDevices;
    try {
      instance.instanceLog('Searching for devices...');
      listDevices = await axios.get(url, config).then((response) => {
        instance.instanceLog('Searching for devices:', response.data);
        const devices = {};
        response.data.forEach((data) => {
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
      instance.instanceError('Searching for devices:', error.message);
    }
    return listDevices ?? {};
  }

  async getDevice(device) {
    const url = `${this.baseUrl}/Device/Get?id=${device.data.id}&buildingID=${device.data.buildingid}`;
    const config = { headers: { 'X-MitsContextKey': this.contextKey } };

    let resultData = {};
    try {
      device.instanceLog('Syncing from device...');
      resultData = await axios.get(url, config).then(async (response) => {
        device.instanceLog('Syncing from device:', response.data);
        return response.data;
      });
    } catch (error) {
      device.instanceError('Syncing from device:', error.message);
    }
    return resultData;
  }

  async setDevice(device, data) {
    const url = `${this.baseUrl}/Device/Set${device.driver.heatPumpType}`;
    const config = { headers: { 'X-MitsContextKey': this.contextKey } };

    let resultData = {};
    try {
      device.instanceLog('Syncing with device...', data);
      resultData = await axios.post(url, data, config).then((response) => {
        device.instanceLog('Syncing with device:', response.data);
        return response.data;
      });
    } catch (error) {
      device.instanceError('Syncing with device:', error.message);
    }
    return resultData;
  }

  async reportEnergyCost(device, daily) {
    const period = daily ? 'daily' : 'total';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toDate = `${yesterday.toISOString().split('T')[0]}T00:00:00`;

    const url = `${this.baseUrl}/EnergyCost/Report`;
    const config = { headers: { 'X-MitsContextKey': this.contextKey } };
    const data = {
      DeviceId: device.data.id,
      FromDate: daily ? toDate : '1970-01-01T00:00:00',
      ToDate: toDate,
      UseCurrency: false,
    };

    let reportData = {};
    try {
      device.instanceLog('Reporting', period, 'energy cost...');
      reportData = await axios.post(url, data, config).then((response) => {
        device.instanceLog('Reporting', period, 'energy cost:', response.data);
        return response.data;
      });
    } catch (error) {
      device.instanceError('Reporting', period, 'energy cost:', error.message);
    }
    return reportData;
  }

  instanceLog(...message) {
    this.log(...message);
  }

  instanceError(...message) {
    this.error(...message);
  }
}

module.exports = MELCloudApp;
