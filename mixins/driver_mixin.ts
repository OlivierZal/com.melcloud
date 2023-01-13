import { Driver } from 'homey'
import PairSession from 'homey/lib/PairSession'
import MELCloudApp from '../app'
import { DeviceInfo, ListDevice, LoginCredentials, MELCloudDevice } from '../types'

export default class MELCloudDriverMixin extends Driver {
  app!: MELCloudApp
  deviceType!: number
  heatPumpType!: string

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
    session.setHandler('list_devices', async (): Promise<DeviceInfo[]> => await this.discoverDevices())
  }

  async discoverDevices <T extends MELCloudDevice> (): Promise<DeviceInfo[]> {
    const devices: Array<ListDevice<T>> = await this.app.listDevices(this.deviceType)
    return devices.map((device: ListDevice<T>): DeviceInfo => {
      const deviceInfo: DeviceInfo = {
        name: device.DeviceName,
        data: {
          id: device.DeviceID,
          buildingid: device.BuildingID
        },
        store: {
          canCool: device.Device.CanCool,
          hasZone2: device.Device.HasZone2
        }
      }
      const capabilities: string[] = this.getRequiredCapabilities(device.Device.CanCool, device.Device.HasZone2)
      if (capabilities.length > 0) {
        deviceInfo.capabilities = capabilities
      }
      return deviceInfo
    })
  }

  getRequiredCapabilities (_canCool?: boolean, _hasZone2?: boolean): string[] {
    return []
  }

  onRepair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
  }
}
