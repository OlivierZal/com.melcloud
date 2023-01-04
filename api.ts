
import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import { ErrorLog, LoginCredentials, Settings } from './types'

module.exports = {
  async login ({ homey, body }: { homey: Homey, body: LoginCredentials }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  },
  async setSettings ({ homey, body }: { homey: Homey, body: Settings }): Promise<void> {
    await (homey.app as MELCloudApp).setSettings(body)
  },
  async getUnitErrorLog ({ homey }: { homey: Homey }): Promise<ErrorLog> {
    return await (homey.app as MELCloudApp).getUnitErrorLog() ?? []
  }
}
