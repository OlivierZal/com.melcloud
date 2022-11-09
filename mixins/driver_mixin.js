const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDriverMixin extends Homey.Driver {
  onPair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
    session.setHandler('list_devices', async () => this.discoverDevices());
  }

  instanceLog(...message) {
    this.log(...message);
  }

  instanceError(...message) {
    this.error(...message);
  }

  onRepair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
  }
}

module.exports = MELCloudDriverMixin;
