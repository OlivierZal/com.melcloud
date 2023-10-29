import { Driver } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import type PairSession from 'homey/lib/PairSession'
import type MELCloudApp from '../app'
import type {
  DeviceDetails,
  GetCapabilityMappingAny,
  ListCapabilityMappingAny,
  ListDevice,
  LoginCredentials,
  MELCloudDriver,
  ReportCapabilityMappingAny,
  SetCapabilityMappingAny,
  Store,
} from '../types'

export default abstract class BaseMELCloudDriver extends Driver {
  public heatPumpType!: string

  public setCapabilityMapping!: SetCapabilityMappingAny

  public getCapabilityMapping!: GetCapabilityMappingAny

  public listCapabilityMapping!: ListCapabilityMappingAny

  public reportCapabilityMapping: ReportCapabilityMappingAny = null

  protected deviceType!: number

  #app!: MELCloudApp

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onInit(): Promise<void> {
    this.#app = this.homey.app as MELCloudApp
    this.registerFlowListeners()
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
      ({ DeviceName, DeviceID, BuildingID, Device }): DeviceDetails => {
        const store: Store = {
          CanCool: 'CanCool' in Device ? Device.CanCool : false,
          HasCO2Sensor: 'HasCO2Sensor' in Device ? Device.HasCO2Sensor : false,
          HasPM25Sensor:
            'HasPM25Sensor' in Device ? Device.HasPM25Sensor : false,
          HasZone2: 'HasZone2' in Device ? Device.HasZone2 : false,
        }
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

  protected abstract registerFlowListeners(): void
}
