const Homey = require('homey'); // eslint-disable-line import/no-unresolved
const http = require('http.min');

class MELCloudDriverMixin extends Homey.Driver {
  async logIn(username, password) {
    let response = false;
    if (username && password) {
      this.homey.settings.set('username', username);
      this.homey.settings.set('password', password);
      const options = {
        uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
        json: {
          AppVersion: '1.9.3.0',
          CaptchaChallenge: '',
          CaptchaResponse: '',
          Email: username,
          Language: '0',
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
        if (error instanceof SyntaxError) {
          this.error(`\`${this.getName()}\`: device not found`);
        } else {
          this.error(`Login to MELCloud: a problem occurred (${error})`);
        }
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
      if (error instanceof SyntaxError) {
        this.error(`\`${this.getName()}\`: device not found`);
      } else {
        this.error(`Searching for devices: a problem occurred (${error})`);
      }
    }
    return deviceList;
  }

  onPair(session) {
    session.setHandler('login', async (data) => this.logIn(data.username, data.password));
    session.setHandler('list_devices', async () => {
      const devices = [];
      const deviceList = await this.discoverDevices();
      deviceList.forEach((device) => {
        // Air-to-air heat pump
        if (device.Device.DeviceType === 0) {
          devices.push({
            name: device.DeviceName,
            data: {
              id: device.DeviceID,
              buildingid: device.BuildingID,
              address: device.MacAddress,
              name: device.DeviceName,
            },
          });
        // Air-to-water heat pump
        } else if (device.Device.DeviceType === 1) {
          devices.push({
            name: device.DeviceName,
            data: {
              id: device.DeviceID,
              buildingid: device.BuildingID,
              address: device.MacAddress,
              name: device.DeviceName,
              zone: 1,
            },
          });
          if (device.Device.HasZone2) {
            devices.push({
              name: `${device.DeviceName} Zone 2`,
              data: {
                id: device.DeviceID,
                buildingid: device.BuildingID,
                address: device.MacAddress,
                name: `${device.DeviceName} Zone 2`,
                zone: 2,
              },
            });
          }
        }
      });
      return devices;
    });
  }
}

module.exports = MELCloudDriverMixin;
