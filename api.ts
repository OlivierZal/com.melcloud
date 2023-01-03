
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import { LoginCredentials, MELCloudDevice, Settings } from './types'

module.exports = {
  async login ({ homey, body }: { homey: Homey, body: LoginCredentials }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  },
  async setSettings ({ homey, body }: { homey: Homey, body: Settings }): Promise<void> {
    const devices: MELCloudDevice[] = [
      ...homey.drivers.getDriver('melcloud').getDevices(),
      ...homey.drivers.getDriver('melcloud_atw').getDevices()
    ] as MELCloudDevice[]
    for (const device of devices) {
      await device.setSettings(body)
    }
  }
}
