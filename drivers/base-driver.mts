import type PairSession from 'homey/lib/PairSession'

// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey'

import {
  type DeviceType,
  type ListDeviceData,
  type LoginCredentials,
  DeviceModel,
} from '@olivierzal/melcloud-api'

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
  OpCapabilities,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../types/index.mts'

const getArg = <T extends DeviceType>(
  capability: string & keyof OpCapabilities<T>,
): keyof FlowArgs<T> => {
  const [arg] = capability.split('.')
  return arg as keyof FlowArgs<T>
}

export abstract class BaseMELCloudDriver<T extends DeviceType>
  // eslint-disable-next-line import-x/no-named-as-default-member
  extends Homey.Driver
{
  declare public readonly getDevices: () => MELCloudDevice[]

  declare public readonly homey: Homey.Homey

  declare public readonly manifest: ManifestDriver

  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping<T>> =
    {}

  public abstract readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<T>

  public abstract readonly getCapabilitiesOptions: (
    data: ListDeviceData<T>,
  ) => Partial<CapabilitiesOptions<T>>

  public abstract readonly getCapabilityTagMapping: GetCapabilityTagMapping<T>

  public abstract readonly listCapabilityTagMapping: ListCapabilityTagMapping<T>

  public abstract readonly setCapabilityTagMapping: SetCapabilityTagMapping<T>

  public abstract readonly type: T

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async onRepair(session: PairSession): Promise<void> {
    this.#handleLogin(session)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    return DeviceModel.getByType(this.type).map(({ data, id, name }) => ({
      capabilities: this.getRequiredCapabilities(data),
      capabilitiesOptions: this.getCapabilitiesOptions(data),
      data: { id },
      name,
    }))
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
    } catch {}
  }

  #registerConditionRunListener(
    capability: string & keyof OpCapabilities<T>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs<T>) => {
          const value = (
            args.device.getCapabilityValue as (
              capability: keyof Capabilities<T>,
            ) => Capabilities<T>[keyof Capabilities<T>]
          )(capability)
          return typeof value === 'string' || typeof value === 'number' ?
              value === args[getArg(capability)]
            : value
        })
    } catch {}
  }

  #registerRunListeners(): void {
    for (const capability of Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }) as (string & keyof OpCapabilities<T>)[]) {
      this.#registerConditionRunListener(capability)
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          capability as string & keyof SetCapabilities<T>,
        )
      }
    }
  }

  #setProducedAndConsumedTagMappings(): void {
    for (const [capability, tags] of Object.entries(
      this.energyCapabilityTagMapping,
    )) {
      const { consumed = [], produced = [] } = Object.groupBy(tags, (tag) =>
        (tag as string).endsWith('Consumed') ? 'consumed' : 'produced',
      )
      this.consumedTagMapping[
        capability as keyof EnergyCapabilityTagMapping<T>
      ] = consumed
      this.producedTagMapping[
        capability as keyof EnergyCapabilityTagMapping<T>
      ] = produced
    }
  }

  public abstract getRequiredCapabilities(data: ListDeviceData<T>): string[]
}
