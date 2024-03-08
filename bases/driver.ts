import type {
  Capabilities,
  CapabilitiesOptions,
  DeviceDetails,
  FlowArgs,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  OpCapabilities,
  ReportCapabilityTagMapping,
  SetCapabilities,
  SetCapabilityTagMapping,
  Store,
  StoreMapping,
} from '../types'
import {
  DeviceType,
  type EffectiveFlags,
  type ListDevice,
  type LoginCredentials,
  type NonEffectiveFlagsKeyOf,
  type NonEffectiveFlagsValueOf,
  type ReportData,
} from '../melcloud/types'
import type BaseMELCloudDevice from './device'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import { NUMBER_1 } from '../constants'
import type PairSession from 'homey/lib/PairSession'

const getArg = <T extends keyof typeof DeviceType>(
  capability: Extract<keyof Capabilities<T>, string>,
): keyof FlowArgs[T] => {
  const [arg]: (keyof FlowArgs[T])[] = capability.split(
    '.',
  ) as (keyof FlowArgs[T])[]
  return arg
}

const getDevice = <T extends keyof typeof DeviceType>(
  args: FlowArgs[T],
): BaseMELCloudDevice<T> => args.device as unknown as BaseMELCloudDevice<T>

const getCapabilitiesOptions = <T extends keyof typeof DeviceType>(
  device: ListDevice[T]['Device'],
): CapabilitiesOptions[T] =>
  ('NumberOfFanSpeeds' in device
    ? {
        fan_power: {
          max: device.NumberOfFanSpeeds,
          min: Number(!device.HasAutomaticFanSpeed),
          step: NUMBER_1,
        },
      }
    : {}) as CapabilitiesOptions[T]

export default abstract class BaseMELCloudDriver<
  T extends keyof typeof DeviceType,
> extends Driver {
  public readonly capabilities: Extract<keyof Capabilities<T>, string>[] =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as Extract<keyof Capabilities<T>, string>[]

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

  protected abstract readonly storeMapping: StoreMapping[T]

  public get heatPumpType(): T {
    return DeviceType[this.deviceType] as T
  }

  public getStore(device: ListDevice[T]['Device']): Store[T] {
    return Object.fromEntries(
      Object.entries(this.storeMapping).map(
        ([key, value]: [string, string]): [
          keyof Store[T],
          NonEffectiveFlagsValueOf<ListDevice[T]['Device']>,
        ] => [
          key as keyof Store[T],
          device[value as NonEffectiveFlagsKeyOf<ListDevice[T]['Device']>],
        ],
      ),
    ) as unknown as Store[T]
  }

  public async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    return Promise.resolve()
  }

  public async onPair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#login(data),
    )
    session.setHandler(
      'list_devices',
      async (): Promise<DeviceDetails<T>[]> => this.#discoverDevices(),
    )
    return Promise.resolve()
  }

  public async onRepair(session: PairSession): Promise<void> {
    session.setHandler(
      'login',
      async (data: LoginCredentials): Promise<boolean> => this.#login(data),
    )
    return Promise.resolve()
  }

  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    return Promise.resolve(
      (this.#app.devicesPerType[this.deviceType] ?? []).map(
        ({
          DeviceName: name,
          DeviceID: id,
          BuildingID: buildingid,
          Device: device,
        }): DeviceDetails<T> => {
          const store: Store[T] = this.getStore(device)
          return {
            capabilities: this.getCapabilities(store),
            capabilitiesOptions: getCapabilitiesOptions(device),
            data: { buildingid, id },
            name,
            store,
          }
        },
      ),
    )
  }

  async #login(data: LoginCredentials): Promise<boolean> {
    this.#app.clearSyncFromDevices()
    return this.#app.applyLogin(data)
  }

  #registerActionRunListener(
    capability: Extract<keyof SetCapabilities[T], string>,
  ): void {
    try {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs[T]): Promise<void> => {
          await args.device.triggerCapabilityListener(
            capability,
            args[getArg(capability)],
          )
        })
    } catch (error: unknown) {
      this.error(error instanceof Error ? error.message : error)
    }
  }

  #registerConditionRunListener(
    capability: Extract<keyof Capabilities<T>, string>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs[T]): boolean => {
          const value = getDevice(args).getCapabilityValue(capability)
          return typeof value === 'boolean'
            ? value
            : (value as number | string) === args[getArg(capability)]
        })
    } catch (error: unknown) {
      this.error(error instanceof Error ? error.message : error)
    }
  }

  #registerRunListeners(): void {
    this.capabilities.forEach(
      (capability: Extract<keyof Capabilities<T>, string>) => {
        this.#registerConditionRunListener(capability)
        if (capability in this.setCapabilityTagMapping) {
          this.#registerActionRunListener(
            capability as Extract<keyof SetCapabilities[T], string>,
          )
        }
      },
    )
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
}
