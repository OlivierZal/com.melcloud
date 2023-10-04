import { Driver } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
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

export default abstract class BaseMELCloudDriver extends Driver {
  public heatPumpType!: string

  public setCapabilityMapping!:
    | Record<
        SetCapability<MELCloudDriverAta>,
        SetCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        SetCapability<MELCloudDriverAtw>,
        SetCapabilityMapping<MELCloudDriverAtw>
      >

  public getCapabilityMapping!:
    | Record<
        GetCapability<MELCloudDriverAta>,
        GetCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        GetCapability<MELCloudDriverAtw>,
        GetCapabilityMapping<MELCloudDriverAtw>
      >

  public listCapabilityMapping!:
    | Record<
        ListCapability<MELCloudDriverAta>,
        ListCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        ListCapability<MELCloudDriverAtw>,
        ListCapabilityMapping<MELCloudDriverAtw>
      >

  public reportCapabilityMapping!:
    | Record<
        ReportCapability<MELCloudDriverAta>,
        ReportCapabilityMapping<MELCloudDriverAta>
      >
    | Record<
        ReportCapability<MELCloudDriverAtw>,
        ReportCapabilityMapping<MELCloudDriverAtw>
      >

  protected deviceType!: number

  #app!: MELCloudApp

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onInit(): Promise<void> {
    this.#app = this.homey.app as MELCloudApp
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onPair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#app.login(data),
    )
    session.setHandler(
      'list_devices',
      async (): Promise<DeviceDetails[]> => this.discoverDevices(),
    )
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onRepair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#app.login(data),
    )
  }

  private async discoverDevices<T extends MELCloudDriver>(): Promise<
    DeviceDetails[]
  > {
    this.#app.clearListDevicesRefresh()
    const devices: ListDevice<T>[] = (await this.#app.listDevices(
      this.deviceType,
    )) as ListDevice<T>[]
    return devices.map(
      ({
        DeviceName,
        DeviceID,
        BuildingID,
        Device: { CanCool, HasZone2 },
      }): DeviceDetails => {
        const store: Store = { CanCool, HasZone2 }
        return {
          name: DeviceName,
          data: { id: DeviceID, buildingid: BuildingID },
          store,
          capabilities: this.getRequiredCapabilities(store),
        }
      },
    )
  }

  public abstract getRequiredCapabilities(store: Store): string[]
}
