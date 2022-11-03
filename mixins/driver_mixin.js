const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudDriverMixin extends Homey.Driver {
  onPair(session) {
    session.setHandler('login', async (data) => this.homey.app.login(data.username, data.password));
    session.setHandler('list_devices', async () => this.discoverDevices());
  }

  getCapabilityTag(capability) {
    if (capability in this.getCapabilityMapping) {
      return this.getCapabilityMapping[capability];
    }
    if (capability in this.listCapabilityMapping) {
      return this.listCapabilityMapping[capability];
    }
    return this.setCapabilityMapping[capability][0];
  }

  getCapabilityEffectiveFlag(capability) {
    return this.setCapabilityMapping[capability][1];
  }
}

module.exports = MELCloudDriverMixin;
