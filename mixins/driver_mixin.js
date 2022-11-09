const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDriverMixin extends Homey.Driver {
  async onPair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
    session.setHandler('list_devices', async () => this.discoverDevices());
  }

  instanceLog(...message) {
    this.log(...message);
  }

  instanceError(...message) {
    this.error(...message);
  }
}

module.exports = MELCloudDriverMixin;
