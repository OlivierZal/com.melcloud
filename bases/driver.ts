import { Driver } from 'homey' // eslint-disable-line import/no-extraneous-dependencies
import type PairSession from 'homey/lib/PairSession'
import type MELCloudApp from '../app'
import {
  HeatPumpType,
  type DeviceDetails,
  type GetCapabilityMappingAta,
  type GetCapabilityMappingAtw,
  type GetCapabilityMappingErv,
  type ListCapabilityMappingAta,
  type ListCapabilityMappingAtw,
  type ListCapabilityMappingErv,
  type ListDevice,
  type LoginCredentials,
  type ReportCapabilityMappingAta,
  type ReportCapabilityMappingAtw,
  type SetCapabilityMappingAta,
  type SetCapabilityMappingAtw,
  type SetCapabilityMappingErv,
  type Store,
} from '../types'

export default abstract class BaseMELCloudDriver<T> extends Driver {
  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  #heatPumpType: keyof typeof HeatPumpType | null = null

  public abstract readonly setCapabilityMapping:
    | SetCapabilityMappingAta
    | SetCapabilityMappingAtw
    | SetCapabilityMappingErv

  public abstract readonly getCapabilityMapping:
    | GetCapabilityMappingAta
    | GetCapabilityMappingAtw
    | GetCapabilityMappingErv

  public abstract readonly listCapabilityMapping:
    | ListCapabilityMappingAta
    | ListCapabilityMappingAtw
    | ListCapabilityMappingErv

  public abstract readonly reportCapabilityMapping:
    | ReportCapabilityMappingAta
    | ReportCapabilityMappingAtw
    | null

  protected abstract readonly deviceType: HeatPumpType

  public get heatPumpType(): keyof typeof HeatPumpType {
    if (!this.#heatPumpType) {
      this.#heatPumpType = HeatPumpType[
        this.deviceType
      ] as keyof typeof HeatPumpType
    }
    return this.#heatPumpType
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onInit(): Promise<void> {
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

  private async discoverDevices(): Promise<DeviceDetails[]> {
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
