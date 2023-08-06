 
import { Driver } from 'homey'
import type PairSession from 'homey/lib/PairSession'
import type MELCloudApp from '../app'
import type MELCloudDriverAta from '../drivers/melcloud/driver'
import type MELCloudDriverAtw from '../drivers/melcloud_atw/driver'
import type {
  DeviceDetails,
  GetCapability,
  GetCapabilityMapping,
  ListCapability,
  ListCapabilityMapping,
  ListDevice,
  LoginCredentials,
  MELCloudDriver,
  ReportCapability,
  ReportCapabilityMapping,
  SetCapability,
  SetCapabilityMapping,
  Store,
} from '../types'

export default abstract class MELCloudDriverMixin extends Driver {
  app!: MELCloudApp

  deviceType!: number

  heatPumpType!: string

  setCapabilityMapping!:
    | Record<
        SetCapability<MELCloudDriverAta>,
        SetCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        SetCapability<MELCloudDriverAtw>,
        SetCapabilityMapping<MELCloudDriverAtw>
      >

  getCapabilityMapping!:
    | Record<
        GetCapability<MELCloudDriverAta>,
        GetCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        GetCapability<MELCloudDriverAtw>,
        GetCapabilityMapping<MELCloudDriverAtw>
      >

  listCapabilityMapping!:
    | Record<
        ListCapability<MELCloudDriverAta>,
        ListCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        ListCapability<MELCloudDriverAtw>,
        ListCapabilityMapping<MELCloudDriverAtw>
      >

  reportCapabilityMapping!:
    | Record<
        ReportCapability<MELCloudDriverAta>,
        ReportCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        ReportCapability<MELCloudDriverAtw>,
        ReportCapabilityMapping<MELCloudDriverAtw>
      >

  // eslint-disable-next-line @typescript-eslint/require-await
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

  async discoverDevices<T extends MELCloudDriver>(): Promise<DeviceDetails[]> {
    this.app.clearListDevicesRefresh()
    const devices: ListDevice<T>[] = (await this.app.listDevices(
      this.deviceType
    )) as ListDevice<T>[]
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

  abstract getRequiredCapabilities(store: Store): string[]

  onRepair(session: PairSession): void {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.app.login(data)
    )
  }
}
