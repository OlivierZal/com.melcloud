import type {
  DeviceDetails,
  GetCapabilityMappingAny,
  ListCapabilityMappingAny,
  ReportCapabilityMappingAny,
  SetCapabilityMappingAny,
  Store,
  TypedString,
} from '../types/types'
import {
  HeatPumpType,
  type LoginCredentials,
  type ReportData,
} from '../types/MELCloudAPITypes'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import type PairSession from 'homey/lib/PairSession'

export default abstract class BaseMELCloudDriver<
  T extends keyof typeof HeatPumpType,
> extends Driver {
  public readonly producedTagMapping: ReportCapabilityMappingAny = {}

  public readonly consumedTagMapping: ReportCapabilityMappingAny = {}

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  public abstract readonly setCapabilityMapping: SetCapabilityMappingAny

  public abstract readonly getCapabilityMapping: GetCapabilityMappingAny

  public abstract readonly listCapabilityMapping: ListCapabilityMappingAny

  public abstract readonly reportCapabilityMapping: ReportCapabilityMappingAny

  protected abstract readonly deviceType: HeatPumpType

  public get heatPumpType(): T {
    return HeatPumpType[this.deviceType] as T
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.registerRunListeners()
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onPair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#login(data),
    )
    session.setHandler(
      'list_devices',
      async (): Promise<DeviceDetails[]> => this.#discoverDevices(),
    )
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onRepair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#login(data),
    )
  }

  async #login(data: LoginCredentials): Promise<boolean> {
    this.#app.clearSyncFromDevices()
    return this.#app.login(data)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async #discoverDevices(): Promise<DeviceDetails[]> {
    return this.#app.devicesPerType[this.deviceType].map(
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

  #setProducedAndConsumedTagMappings(): void {
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

  protected abstract registerRunListeners(): void
}
