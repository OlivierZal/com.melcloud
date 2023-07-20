// eslint-disable-next-line import/no-extraneous-dependencies
import { Driver } from 'homey'
import type PairSession from 'homey/lib/PairSession'
import type MELCloudApp from '../app'
import type {
  DeviceDetails,
  ListDevice,
  LoginCredentials,
  MELCloudDevice,
  Store,
} from '../types'

export default class MELCloudDriverMixin extends Driver {
  app!: MELCloudApp

  deviceType!: number

  heatPumpType!: string

  async onInit(): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair(session: PairSession): void {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.app.login(data)
    )
    session.setHandler(
      'list_devices',
      async (): Promise<DeviceDetails[]> => this.discoverDevices()
    )
  }

  async discoverDevices<T extends MELCloudDevice>(): Promise<DeviceDetails[]> {
    this.app.clearListDevicesRefresh()
    const devices: Array<ListDevice<T>> = await this.app.listDevices(
      this.deviceType
    )
    return devices.map(
      ({
        DeviceName,
        DeviceID,
        BuildingID,
        Device: { CanCool, HasZone2 },
      }): DeviceDetails => {
        const store: Store = {
          canCool: CanCool,
          hasZone2: HasZone2,
        }
        return {
          name: DeviceName,
          data: { id: DeviceID, buildingid: BuildingID },
          store,
          capabilities: this.getRequiredCapabilities(store),
        }
      }
    )
  }

  getRequiredCapabilities(_store: Store): string[] {
    throw new Error('Method not implemented.')
  }

  onRepair(session: PairSession): void {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.app.login(data)
    )
  }
}
