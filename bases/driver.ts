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
  public readonly heatPumpType!: string

  public readonly setCapabilityMapping!: SetCapabilityMappingAny

  public readonly getCapabilityMapping!: GetCapabilityMappingAny

  public readonly listCapabilityMapping!: ListCapabilityMappingAny

  public readonly reportCapabilityMapping: ReportCapabilityMappingAny = null

  protected readonly deviceType!: number

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
      ({
        DeviceName: name,
        DeviceID: id,
        BuildingID: buildingid,
        Device: device,
      }): DeviceDetails => {
        const store: Store = {
          canCool: 'CanCool' in device ? device.CanCool : false,
          hasCO2Sensor: 'HasCO2Sensor' in device ? device.HasCO2Sensor : false,
          hasPM25Sensor:
            'HasPM25Sensor' in device ? device.HasPM25Sensor : false,
          hasZone2: 'HasZone2' in device ? device.HasZone2 : false,
        }
        return {
          name,
          data: { id, buildingid },
          store,
          capabilities: this.getRequiredCapabilities(store),
        }
      },
    )
  }

  public abstract getRequiredCapabilities(store: Store): string[]

  protected abstract registerFlowListeners(): void
}
