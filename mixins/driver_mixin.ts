import { Driver } from 'homey'
import PairSession from 'homey/lib/PairSession'

import MELCloudApp from '../app'
import MELCloudDeviceAta from '../drivers/melcloud/device'
import MELCloudDeviceAtw from '../drivers/melcloud_atw/device'
import { DeviceInfo, LoginCredentials } from '../types'

export default class MELCloudDriverMixin extends Driver {
  app!: MELCloudApp

  deviceType!: number
  heatPumpType!: string

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
    session.setHandler('list_devices', async (): Promise<Array<DeviceInfo<MELCloudDeviceAta>> | Array<DeviceInfo<MELCloudDeviceAtw>>> => await this.discoverDevices())
  }

  async discoverDevices (): Promise<Array<DeviceInfo<MELCloudDeviceAta>> | Array<DeviceInfo<MELCloudDeviceAtw>>> {
    throw new Error('Method not implemented.')
  }

  onRepair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
  }
}
