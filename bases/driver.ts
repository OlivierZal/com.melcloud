import type {
  DeviceDetails,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  ReportCapabilityTagMapping,
  SetCapabilityTagMapping,
  Store,
} from '../types'
import {
  DeviceType,
  type ListDeviceAny,
  type LoginCredentials,
  type ReportData,
  type effectiveFlagsAta,
  type effectiveFlagsAtw,
  type effectiveFlagsErv,
} from '../melcloud/types'
import { NUMBER_0, NUMBER_1 } from '../constants'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import type PairSession from 'homey/lib/PairSession'

const getCapabilityOptions = (
  capabilities: string[],
  device: ListDeviceAny['Device'],
): DeviceDetails['capabilitiesOptions'] =>
  capabilities.includes('fan_power') && 'NumberOfFanSpeeds' in device
    ? {
        fan_power: {
          max: device.NumberOfFanSpeeds,
          min: device.HasAutomaticFanSpeed ? NUMBER_0 : NUMBER_1,
          step: NUMBER_1,
        },
      }
    : {}

export default abstract class BaseMELCloudDriver<
  T extends keyof typeof DeviceType,
> extends Driver {
  public readonly consumedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  public readonly producedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  readonly #app: MELCloudApp = this.homey.app as MELCloudApp

  public abstract readonly effectiveFlags:
    | typeof effectiveFlagsAta
    | typeof effectiveFlagsAtw
    | typeof effectiveFlagsErv

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async #discoverDevices(): Promise<DeviceDetails[]> {
    return (this.#app.devicesPerType[this.deviceType] ?? []).map(
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
        const capabilities: string[] = this.getRequiredCapabilities(store)
        return {
          capabilities,
          capabilitiesOptions: getCapabilityOptions(capabilities, device),
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

  #setProducedAndConsumedTagMappings(): void {
    Object.entries(this.reportCapabilityTagMapping).forEach(
      ([capability, tags]: [
        string,
        Extract<keyof ReportData[T], string>[],
      ]) => {
        ;(this.producedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as Extract<keyof ReportData[T], string>[]) = tags.filter(
          (tag) => !tag.endsWith('Consumed'),
        )
        ;(this.consumedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as Extract<keyof ReportData[T], string>[]) = tags.filter((tag) =>
          tag.endsWith('Consumed'),
        )
      },
    )
  }

  public abstract getRequiredCapabilities(store: Store): string[]

  protected abstract registerRunListeners(): void
}
