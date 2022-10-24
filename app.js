const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudApp extends Homey.App {
  async onInit() {
    this.baseUrl = 'https://app.melcloud.com/Mitsubishi.Wifi.Client';
  }

  async login(username, password) {
    let response = false;
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
        this.log('Login to MELCloud: authentication has been completed');
      } catch (error) {
        this.error(`Login to MELCloud: a problem occurred (${error})`);
      }
    }
    return response;
  }

  async listDevices(driver) {
    let deviceList = [];
    const options = {
      uri: `${this.baseUrl}/User/ListDevices`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      driver.log('Searching for devices...');
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
            if (driver.deviceType === device.Device.DeviceType) {
              devices.push(device);
            }
          });
          data.Structure.Areas.forEach((area) => {
            area.Devices.forEach((device) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices.push(device);
              }
            });
          });
          data.Structure.Floors.forEach((floor) => {
            floor.Devices.forEach((device) => {
              if (driver.deviceType === device.Device.DeviceType) {
                devices.push(device);
              }
            });
            floor.Areas.forEach((area) => {
              area.Devices.forEach((device) => {
                if (driver.deviceType === device.Device.DeviceType) {
                  devices.push(device);
                }
              });
            });
          });
        });
        return devices;
      });
      driver.log('Searching for devices: search has been completed');
    } catch (error) {
      driver.error(`Searching for devices: a problem occurred (${error})`);
    }
    return deviceList;
  }

  async getDeviceFromList(device) {
    const data = device.getData();
    const deviceList = await this.listDevices(device.driver);
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const deviceFromList of deviceList) {
      if (deviceFromList.DeviceID === data.id && deviceFromList.BuildingID === data.buildingid) {
        return deviceFromList;
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */
    return null;
  }

  async getDevice(device) {
    let resultData = {};
    const data = device.getData();
    const options = {
      uri: `${this.baseUrl}/Device/Get?id=${data.id}&buildingID=${data.buildingid}`,
      headers: { 'X-MitsContextKey': this.homey.settings.get('ContextKey') },
      json: true,
    };
    try {
      device.log(`\`${device.getName()}\`: syncing from device...`);
      resultData = await http.get(options).then(async (result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        device.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        device.error(`\`${device.getName()}\`: device not found while syncing from device`);
      } else {
        device.error(`\`${device.getName()}\`: a problem occurred while syncing from device (${error})`);
      }
    }
    return resultData;
  }

  async setDevice(device, json) {
    let resultData = {};
    const options = {
      uri: `${this.baseUrl}/Device/Set${device.driver.heatPumpType}`,
      headers: { 'X-MitsContextKey': device.homey.settings.get('ContextKey') },
      json,
    };
    try {
      device.log(`\`${device.getName()}\`: syncing with device...`);
      resultData = await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        device.log(json);
        device.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        device.error(`\`${device.getName()}\`: device not found while syncing with device`);
      } else {
        device.error(`\`${device.getName()}\`: a problem occurred while syncing with device (${error})`);
      }
    }
    return resultData;
  }

  async fetchEnergyReport(device, daily) {
    let reportData = {};

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const toDate = `${yesterday.toISOString().split('T')[0]}T00:00:00`;

    const data = device.getData();
    const options = {
      uri: `${this.baseUrl}/EnergyCost/Report`,
      headers: { 'X-MitsContextKey': device.homey.settings.get('ContextKey') },
      json: {
        DeviceId: data.id,
        FromDate: daily ? toDate : '1970-01-01T00:00:00',
        ToDate: toDate,
        UseCurrency: false,
      },
    };
    const period = daily ? 'daily' : 'total';

    try {
      device.log(`\`${device.getName()}\`: fetching ${period} energy report...`);
      reportData = await http.post(options).then((result) => {
        if (result.response.statusCode !== 200) {
          throw new Error(`\`statusCode\`: ${result.response.statusCode}`);
        }
        device.log(result.data);
        if (result.data.ErrorMessage) {
          throw new Error(result.data.ErrorMessage);
        }
        return result.data;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        device.error(`\`${device.getName()}\`: device not found while fetching ${period} energy report`);
      } else {
        device.error(`\`${device.getName()}\`: a problem occurred while fetching ${period} energy report (${error})`);
      }
    }
    return reportData;
  }

  async syncDataFromDevice(device) {
    this.homey.clearTimeout(device.syncTimeout);

    const resultData = await this.getDevice(device);

    await this.updateCapabilities(device, resultData);
  }

  async syncDataToDevice(device, updateJson) {
    this.homey.clearTimeout(device.syncTimeout);

    const data = device.getData();
    const json = {
      DeviceID: data.id,
      HasPendingCommand: true,
    };
    let effectiveFlags = BigInt(0);
    Object.keys(device.driver.setCapabilityMapping).forEach((capability) => {
      if (device.hasCapability(capability)) {
        if (capability in updateJson) {
          // eslint-disable-next-line no-bitwise
          effectiveFlags |= device.driver.getCapabilityEffectiveFlag(capability);
          json[
            device.driver.getCapabilityTag(capability)
          ] = device.getCapabilityValueToDevice(capability, updateJson[capability]);
        } else {
          json[
            device.driver.getCapabilityTag(capability)
          ] = device.getCapabilityValueToDevice(capability);
        }
      }
    });
    json.EffectiveFlags = Number(effectiveFlags);
    const resultData = await this.setDevice(device, json);

    await this.updateCapabilities(device, resultData);
  }

  async updateCapabilities(device, resultData) {
    /* eslint-disable no-await-in-loop, no-restricted-syntax */
    for (const capability in device.driver.setCapabilityMapping) {
      if (!resultData.EffectiveFlags || (
        // eslint-disable-next-line no-bitwise
        device.driver.getCapabilityEffectiveFlag(capability) & BigInt(resultData.EffectiveFlags))
      ) {
        await device.setCapabilityValueFromDevice(
          capability,
          resultData[device.driver.getCapabilityTag(capability)],
        );
      }
    }

    for (const capability in device.driver.getCapabilityMapping) {
      if (Object.prototype.hasOwnProperty.call(device.driver.getCapabilityMapping, capability)) {
        await device.setCapabilityValueFromDevice(
          capability,
          resultData[device.driver.getCapabilityTag(capability)],
        );
      }
    }

    let deviceFromList;
    if (device.driver.listCapabilityMapping) {
      deviceFromList = await this.getDeviceFromList(device);
      for (const capability in device.driver.listCapabilityMapping) {
        if (Object.prototype.hasOwnProperty.call(device.driver.listCapabilityMapping, capability)) {
          await device.setCapabilityValueFromDevice(
            capability,
            deviceFromList.Device[device.driver.getCapabilityTag(capability)],
          );
        }
      }
    }
    /* eslint-enable no-await-in-loop, no-restricted-syntax */

    await device.endSyncData(deviceFromList);
  }
}

module.exports = MELCloudApp;
