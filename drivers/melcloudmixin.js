const Homey = require('homey');
const http = require('http.min');

class MelCloudDriverMixin extends Homey.Driver {
  async logIn(username, password) {
    let response = false;
    if (username && password) {
      this.homey.settings.set('username', username);
      this.homey.settings.set('password', password);
      const request = {
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
      response = await http.post(request).then((result) => {
        if (result.data.ErrorId) {
          return false;
        }
        this.homey.settings.set('ContextKey', result.data.LoginData.ContextKey);
        return true;
      });
      this.syncTimeout = setTimeout(this.logIn.bind(this), 24 * 3600 * 1000);
    }
    return response;
  }

  async discoverDevices() {
    const ContextKey = this.homey.settings.get('ContextKey');
    const request = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices',
      json: true,
      headers: { 'X-MitsContextKey': ContextKey },
    };
    return http.get(request).then((result) => {
      if (result.response.statusCode !== 200) {
        throw new Error('No device');
      }
      const deviceList = [];
      result.data.forEach((data) => {
        data.Structure.Devices.forEach((device) => {
          if (this.DeviceType === device.Device.DeviceType) {
            deviceList.push(device);
          }
        });
        data.Structure.Areas.forEach((area) => {
          area.Devices.forEach((device) => {
            if (this.DeviceType === device.Device.DeviceType) {
              deviceList.push(device);
            }
          });
        });
        data.Structure.Floors.forEach((floor) => {
          floor.Devices.forEach((device) => {
            if (this.DeviceType === device.Device.DeviceType) {
              deviceList.push(device);
            }
          });
          floor.Areas.forEach((area) => {
            area.Devices.forEach((device) => {
              if (this.DeviceType === device.Device.DeviceType) {
                deviceList.push(device);
              }
            });
          });
        });
      });
      return deviceList;
    });
  }

  onPair(session) {
    session.setHandler('login', async (data) => this.logIn(data.username, data.password));
    session.setHandler('list_devices', async () => {
      const devices = [];
      const deviceList = await this.discoverDevices();
      deviceList.forEach((device) => {
        // Air conditioner
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
        // Heat pump
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

module.exports = MelCloudDriverMixin;
