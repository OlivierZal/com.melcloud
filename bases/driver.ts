import {
  type DeviceDetails,
  type GetCapabilityMappingAny,
  HeatPumpType,
  type ListCapabilityMappingAny,
  type ListDevice,
  type LoginCredentials,
  type ReportCapabilityMappingAny,
  type ReportData,
  type SetCapabilityMappingAny,
  type Store,
  type TypedString,
} from '../types'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import type PairSession from 'homey/lib/PairSession'

export default abstract class BaseMELCloudDriver<T> extends Driver {
  public heatPumpType!: keyof typeof HeatPumpType

  public producedTagMapping: ReportCapabilityMappingAny = {}

  public consumedTagMapping: ReportCapabilityMappingAny = {}

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  public abstract readonly setCapabilityMapping: SetCapabilityMappingAny

  public abstract readonly getCapabilityMapping: GetCapabilityMappingAny

  public abstract readonly listCapabilityMapping: ListCapabilityMappingAny

  public abstract readonly reportCapabilityMapping: ReportCapabilityMappingAny

  protected abstract readonly deviceType: HeatPumpType

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onInit(): Promise<void> {
    this.heatPumpType = HeatPumpType[
      this.deviceType
    ] as keyof typeof HeatPumpType
    this.setProducedAndConsumedTagMappings()
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
          capabilities: this.getRequiredCapabilities(store),
          data: { buildingid, id },
          name,
          store,
        }
      },
    )
  }

  private setProducedAndConsumedTagMappings(): void {
    Object.entries(this.reportCapabilityMapping).forEach(
      ([capability, tags]: [string, TypedString<keyof ReportData<T>>[]]) => {
        ;(this.producedTagMapping[
          capability as keyof ReportCapabilityMappingAny
        ] as TypedString<keyof ReportData<T>>[]) = tags.filter(
          (tag: TypedString<keyof ReportData<T>>) => !tag.endsWith('Consumed'),
        )
        ;(this.consumedTagMapping[
          capability as keyof ReportCapabilityMappingAny
        ] as TypedString<keyof ReportData<T>>[]) = tags.filter(
          (tag: TypedString<keyof ReportData<T>>) => tag.endsWith('Consumed'),
        )
      },
    )
  }

  public abstract getRequiredCapabilities(store: Store): string[]

  protected abstract registerFlowListeners(): void
}
