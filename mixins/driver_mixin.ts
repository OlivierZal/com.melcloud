import { Driver } from 'homey'
import PairSession from 'homey/lib/PairSession'
import MELCloudApp from '../app'
import { DeviceDetails, ListDevice, LoginCredentials, MELCloudDevice } from '../types'

export default class MELCloudDriverMixin extends Driver {
  app!: MELCloudApp
  deviceType!: number
  heatPumpType!: string

  async onInit (): Promise<void> {
    this.app = this.homey.app as MELCloudApp
  }

  onPair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
    session.setHandler('list_devices', async (): Promise<DeviceDetails[]> => await this.discoverDevices())
  }

  async discoverDevices <T extends MELCloudDevice> (): Promise<DeviceDetails[]> {
    const devices: Array<ListDevice<T>> = await this.app.listDevices(this.deviceType)
    return devices.map((device: ListDevice<T>): DeviceDetails => {
      const deviceDetails: DeviceDetails = {
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
        deviceDetails.capabilities = capabilities
      }
      return deviceDetails
    })
  }

  getRequiredCapabilities (_canCool?: boolean, _hasZone2?: boolean): string[] {
    return []
  }

  onRepair (session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials): Promise<boolean> => await this.app.login(data))
  }
}
