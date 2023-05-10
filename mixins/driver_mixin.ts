import { Driver } from 'homey'
import type PairSession from 'homey/lib/PairSession'
import type MELCloudApp from '../app'
import {
  type DeviceDetails,
  type ListDevice,
  type LoginCredentials,
  type MELCloudDevice,
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
      async (data: LoginCredentials): Promise<boolean> =>
        await this.app.login(data)
    )
    session.setHandler(
      'list_devices',
      async (): Promise<DeviceDetails[]> => await this.discoverDevices()
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
      }): DeviceDetails => ({
        name: DeviceName,
        data: { id: DeviceID, buildingid: BuildingID },
        store: { canCool: CanCool, hasZone2: HasZone2 },
        capabilities: this.getRequiredCapabilities(CanCool, HasZone2),
      })
    )
  }

  getRequiredCapabilities(
    _canCool: boolean,
    _hasZone2: boolean
  ): string[] | undefined {
    return undefined
  }

  onRepair(session: PairSession): void {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> =>
        await this.app.login(data)
    )
  }
}
