import 'source-map-support/register'
import Homey from 'homey'
import PairSession from 'homey/lib/PairSession'
import MELCloudApp from '../app'
import { DeviceInfo, LoginCredentials } from '../types'

export default class MELCloudDriverMixin extends Homey.Driver {
  app!: MELCloudApp

  deviceType!: number
  heatPumpType!: string

  setCapabilityMapping!: { [key: string]: { tag: string, effectiveFlag: bigint } }
  getCapabilityMapping!: { [key: string]: { tag: string } }
  listCapabilityMapping!: { [key: string]: { tag: string } }

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => await this.app.login(data))
    session.setHandler('list_devices', async () => await this.discoverDevices())
  }

  onRepair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => await this.app.login(data))
  }

  async discoverDevices (): Promise<DeviceInfo[]> {
    throw new Error('Method not implemented.')
  }
}
