import 'source-map-support/register'
import Homey from 'homey'
import PairSession from 'homey/lib/PairSession'

import MELCloudApp from '../app'
import { DeviceInfo, LoginCredentials, MELCloudDevice } from '../types'

export default class MELCloudDriverMixin extends Homey.Driver {
  app!: MELCloudApp

  deviceType!: number
  heatPumpType!: string

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => await this.app.login(data))
    session.setHandler('list_devices', async () => await this.discoverDevices())
  }

  async discoverDevices (): Promise<Array<DeviceInfo<MELCloudDevice>>> {
    throw new Error('Method not implemented.')
  }

  onRepair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => await this.app.login(data))
  }
}
