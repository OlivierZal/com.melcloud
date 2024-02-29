import type {
  CapabilitiesOptions,
  DeviceDetails,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OpCapabilities,
  ReportCapabilityTagMapping,
  SetCapabilityTagMapping,
  Store,
} from '../types'
import {
  DeviceType,
  type EffectiveFlags,
  type ListDevice,
  type LoginCredentials,
  type ReportData,
} from '../melcloud/types'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import type PairSession from 'homey/lib/PairSession'

export default abstract class BaseMELCloudDriver<
  T extends keyof typeof DeviceType,
> extends Driver {
  public readonly consumedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  public readonly lastCapabilitiesToUpdate: (keyof OpCapabilities[T])[] = []

  public readonly producedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  public abstract readonly effectiveFlags: EffectiveFlags[T]

  public abstract readonly getCapabilityTagMapping: GetCapabilityTagMapping[T]

  public abstract readonly listCapabilityTagMapping: ListCapabilityTagMapping[T]

  public abstract readonly reportCapabilityTagMapping: ReportCapabilityTagMapping[T]

  public abstract readonly setCapabilityTagMapping: SetCapabilityTagMapping[T]

  protected abstract readonly deviceType: DeviceType

  public get heatPumpType(): T {
    return DeviceType[this.deviceType] as T
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
      async (): Promise<DeviceDetails<T>[]> => this.#discoverDevices(),
    )
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public async onRepair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#login(data),
    )
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    return (this.#app.devicesPerType[this.deviceType] ?? []).map(
      ({
        DeviceName: name,
        DeviceID: id,
        BuildingID: buildingid,
        Device: device,
      }): DeviceDetails<T> => {
        const store: Store[T] = this.getStore(device)
        const capabilities: string[] = this.getCapabilities(store)
        return {
          capabilities,
          capabilitiesOptions: this.getCapabilitiesOptions(device),
          data: { buildingid, id },
          name,
          store,
        }
      },
    )
  }

  async #login(data: LoginCredentials): Promise<boolean> {
    this.#app.clearSyncFromDevices()
    return this.#app.applyLogin(data)
  }

  #setProducedAndConsumedTagMappings<
    K extends Extract<keyof ReportData[T], string>,
  >(): void {
    Object.entries(this.reportCapabilityTagMapping).forEach(
      ([capability, tags]: [string, K[]]) => {
        ;(this.producedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as K[]) = tags.filter((tag: K) => !tag.endsWith('Consumed'))
        ;(this.consumedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as K[]) = tags.filter((tag: K) => tag.endsWith('Consumed'))
      },
    )
  }

  public abstract getCapabilities(store: Store[T]): string[]

  public abstract getStore(device: ListDevice[T]['Device']): Store[T]

  protected abstract getCapabilitiesOptions(
    device: ListDevice[T]['Device'],
  ): Partial<CapabilitiesOptions[T]>

  protected abstract registerRunListeners(): void
}
