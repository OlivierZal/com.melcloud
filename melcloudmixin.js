const Homey = require('homey');
const http = require('http.min');

function getMelCloudDevices(callback) {
  const ContextKey = Homey.ManagerSettings.get('ContextKey');
  const request = {
    uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices',
    json: true,
    headers: { 'X-MitsContextKey': ContextKey },
  };
  http.get(request).then((result) => {
    if (result.response.statusCode !== 200) {
      throw new Error('No device');
    }
    const deviceList = [];
    const devices = [];
    result.data.forEach((data) => {
      data.Structure.Devices.forEach((device) => {
        deviceList.push(device);
      });
      data.Structure.Areas.forEach((area) => {
        area.Devices.forEach((device) => {
          deviceList.push(device);
        });
      });
      data.Structure.Floors.forEach((floor) => {
        floor.Devices.forEach((device) => {
          deviceList.push(device);
        });
        floor.Areas.forEach((area) => {
          area.Devices.forEach((device) => {
            deviceList.push(device);
          });
        });
      });
    });
    deviceList.forEach((device) => {
      devices.push({
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID,
          address: device.MacAddress,
          name: device.DeviceName,
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
    });
    callback(devices);
  });
}

class MelCloudDriverMixin extends Homey.Driver {
  getToken(username, password, callback) {
    Homey.ManagerSettings.set('username', username);
    Homey.ManagerSettings.set('password', password);
    const request = {
      uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
      json: {
        AppVersion: '1.9.3.0',
        CaptchaChallenge: '',
        CaptchaResponse: '',
        Email: username,
        Language: '0',
        Password: password,
        Persist: 'true',
      },
    };
    http.post(request).then((result) => {
      if (result.data.ErrorId !== null) {
        return callback(false);
      }
      Homey.ManagerSettings.set('ContextKey', result.data.LoginData.ContextKey);
      return callback(true);
    });
    this.syncTimeout = setTimeout(this.getToken.bind(this), (24 * 3600 * 1000));
  }

  onPair(socket) {
    socket.on('login', (data, callback) => {
      if (data.username === '' || data.password === '') {
        callback(null, false);
      } else {
        this.getToken(data.username, data.password, (response) => {
          callback(null, response);
        });
      }
    });
    socket.on('list_devices', (data, callback) => {
      getMelCloudDevices((devices) => {
        callback(null, devices);
      });
    });
    socket.on('add_device', () => {});
  }
}

module.exports = { MelCloudDriverMixin };
