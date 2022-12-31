import Homey from 'homey/lib/Homey'
import MELCloudApp from './app'
import { LoginCredentials } from './types'

module.exports = {
  async login ({ homey, body }: { homey: Homey, body: LoginCredentials }): Promise<boolean> {
    return await (homey.app as MELCloudApp).login(body)
  }
}
