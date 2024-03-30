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
  type ReportData,
} from '../melcloud/types'
import type BaseMELCloudDevice from './device'
import { Driver } from 'homey'
import type MELCloudApp from '../app'
import { NUMBER_1 } from '../constants'
import type PairSession from 'homey/lib/PairSession'

const getArg = <T extends keyof typeof DeviceType>(
  capability: Extract<keyof Capabilities[T], string>,
): keyof FlowArgs[T] => {
  const [arg] = capability.split('.')
  return arg.replace(/_with_cool$/u, '') as keyof FlowArgs[T]
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
  public readonly capabilities =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    this.manifest.capabilities as Extract<keyof Capabilities[T], string>[]

  public readonly consumedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  public readonly lastCapabilitiesToUpdate: (keyof OpCapabilities[T])[] = []

  public readonly producedTagMapping: Partial<ReportCapabilityTagMapping[T]> =
    {}

  readonly #app = this.homey.app as MELCloudApp

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
      Object.entries(this.storeMapping).map(([key, value]) => [
        key as keyof Store[T],
        device[value as NonEffectiveFlagsKeyOf<ListDevice[T]['Device']>],
      ]),
    ) as unknown as Store[T]
  }

  public async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    return Promise.resolve()
  }

  public async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view === 'login' && (await this.#app.applyLogin())) {
        await session.showView('list_devices')
      }
    })
    session.setHandler('login', async (data: LoginCredentials) =>
      this.#app.applyLogin(data, true),
    )
    session.setHandler('list_devices', async () => this.#discoverDevices())
    return Promise.resolve()
  }

  public async onRepair(session: PairSession): Promise<void> {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.#app.applyLogin(data, true),
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
        }) => {
          const store = this.getStore(device)
          return {
            capabilities: this.getRequiredCapabilities(store),
            capabilitiesOptions: getCapabilitiesOptions(device),
            data: { buildingid, id },
            name,
            store,
          }
        },
      ),
    )
  }

  #registerActionRunListener(
    capability: Extract<keyof SetCapabilities[T], string>,
  ): void {
    try {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs[T]) => {
          await args.device.triggerCapabilityListener(
            capability,
            args[getArg(capability)],
          )
        })
    } catch (error) {
      // Skip
    }
  }

  #registerConditionRunListener(
    capability: Extract<keyof Capabilities[T], string>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs[T]) => {
          const value = getDevice(args).getCapabilityValue(capability)
          return typeof value === 'boolean'
            ? value
            : (value as number | string) === args[getArg(capability)]
        })
    } catch (error) {
      // Skip
    }
  }

  #registerRunListeners<
    K extends Extract<keyof Capabilities[T], string>,
  >(): void {
    Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).forEach((capability) => {
      this.#registerConditionRunListener(capability as K)
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          capability as Extract<keyof SetCapabilities[T], string>,
        )
      }
    })
  }

  #setProducedAndConsumedTagMappings<
    K extends Extract<keyof ReportData[T], string>,
  >(): void {
    Object.entries(this.reportCapabilityTagMapping).forEach(
      ([capability, tags]: [string, K[]]) => {
        ;(this.producedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as K[]) = tags.filter((tag) => !tag.endsWith('Consumed'))
        ;(this.consumedTagMapping[
          capability as keyof ReportCapabilityTagMapping[T]
        ] as K[]) = tags.filter((tag) => tag.endsWith('Consumed'))
      },
    )
  }

  public abstract getRequiredCapabilities(store: Store[T]): string[]
}
