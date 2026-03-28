import type {
  DeviceType,
  ListDeviceData,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type PairSession from 'homey/lib/PairSession'

import type {
  Capabilities,
  CapabilitiesOptions,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  FlowArgs,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  ManifestDriver,
  MELCloudDevice,
  OperationalCapabilities,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../types/index.mts'
import { type Homey, Driver } from '../lib/homey.mts'
import { typedEntries, typedKeys } from '../lib/index.mts'

const getArg = <T extends DeviceType>(
  capability: string & keyof OperationalCapabilities<T>,
): keyof FlowArgs<T> => {
  const [arg] = capability.split('.')
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  return arg as keyof FlowArgs<T>
}

export abstract class BaseMELCloudDriver<T extends DeviceType> extends Driver {
  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public abstract readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<T>

  public abstract readonly getCapabilitiesOptions: (
    data: ListDeviceData<T>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract readonly getCapabilityTagMapping: GetCapabilityTagMapping<T>

  declare public readonly getDevices: () => MELCloudDevice[]

  declare public readonly homey: Homey.Homey

  public abstract readonly listCapabilityTagMapping: ListCapabilityTagMapping<T>

  declare public readonly manifest: ManifestDriver

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public abstract readonly setCapabilityTagMapping: SetCapabilityTagMapping<T>

  public abstract readonly type: T

  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        if (await this.#login()) {
          await session.showView('list_devices')
          return
        }
        await session.showView('login')
      }
    })
    this.#handleLogin(session)
    session.setHandler('list_devices', async () => this.#discoverDevices())
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    this.#handleLogin(session)
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public abstract getRequiredCapabilities(data: ListDeviceData<T>): string[]

  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve(
      this.homey.app.api.registry
        .getDevicesByType(this.type)
        .map(({ data, id, name }) => ({
          capabilities: this.getRequiredCapabilities(data),
          capabilitiesOptions: this.getCapabilitiesOptions(data),
          data: { id },
          name,
        })),
    )
  }

  #handleLogin(session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.#login(data),
    )
  }

  async #login(data?: LoginCredentials): Promise<boolean> {
    return this.homey.app.api.authenticate(data)
  }

  #registerActionRunListener(
    capability: string & keyof SetCapabilities<T>,
  ): void {
    try {
      this.homey.flow
        .getActionCard(`${capability}_action`)
        .registerRunListener(async (args: FlowArgs<T>) => {
          await args.device.triggerCapabilityListener(
            capability,
            args[getArg(capability)],
          )
        })
    } catch {
      // Flow card may not exist for this capability
    }
  }

  #registerConditionRunListener(
    capability: string & keyof OperationalCapabilities<T>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs<T>) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          const getCapabilityValue = args.device.getCapabilityValue as (
            capability: keyof Capabilities<T>,
          ) => Capabilities<T>[keyof Capabilities<T>]
          const value = getCapabilityValue(capability)
          return typeof value === 'string' || typeof value === 'number' ?
              value === args[getArg(capability)]
            : value
        })
    } catch {
      // Flow card may not exist for this capability
    }
  }

  #registerRunListeners(): void {
    for (const capability of typedKeys<
      string & keyof OperationalCapabilities<T>
    >({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    })) {
      this.#registerConditionRunListener(capability)
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          capability as string & keyof SetCapabilities<T>,
        )
      }
    }
  }

  #setProducedAndConsumedTagMappings(): void {
    for (const [capability, tags] of typedEntries<
      string & keyof EnergyCapabilityTagMapping<T>,
      EnergyCapabilityTagMapping<T>[keyof EnergyCapabilityTagMapping<T>]
    >(this.energyCapabilityTagMapping)) {
      const { consumed = [], produced = [] } = Object.groupBy(tags, (tag) =>
        tag.endsWith('Consumed') ? 'consumed' : 'produced',
      )
      this.consumedTagMapping[capability] = consumed
      this.producedTagMapping[capability] = produced
    }
  }
}
