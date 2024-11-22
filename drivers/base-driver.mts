import {
  DeviceModel,
  type DeviceType,
  type EnergyData,
  type ListDeviceData,
  type LoginCredentials,
} from '@olivierzal/melcloud-api'
// eslint-disable-next-line import/default, import/no-extraneous-dependencies
import Homey from 'homey'

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
  OpCapabilities,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../types/index.mts'

const getArg = <T extends DeviceType>(
  capability: Extract<keyof OpCapabilities<T>, string>,
): keyof FlowArgs<T> => {
  const [arg] = capability.split('.')
  return arg as keyof FlowArgs<T>
}

export abstract class BaseMELCloudDriver<T extends DeviceType>
  // eslint-disable-next-line import/no-named-as-default-member
  extends Homey.Driver
{
  public declare readonly homey: Homey.Homey

  public declare readonly manifest: ManifestDriver

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

  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
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
    return Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    this.#handleLogin(session)
    return Promise.resolve()
  }

  public override getDevices(): MELCloudDevice[] {
    return super.getDevices() as MELCloudDevice[]
  }

  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    return Promise.resolve(
      DeviceModel.getByType(this.type).map(({ data, id, name }) => ({
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
    capability: Extract<keyof SetCapabilities<T>, string>,
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
    capability: Extract<keyof OpCapabilities<T>, string>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs<T>) => {
          const value = (
            args.device.getCapabilityValue as (
              capability: string & keyof Capabilities<T>,
            ) => Capabilities<T>[string & keyof Capabilities<T>]
          )(capability)
          return typeof value === 'boolean' ? value : (
              (value as number | string) === args[getArg(capability)]
            )
        })
    } catch {}
  }

  #registerRunListeners(): void {
    Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).forEach((capability) => {
      this.#registerConditionRunListener(
        capability as Extract<keyof OpCapabilities<T>, string>,
      )
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          capability as Extract<keyof SetCapabilities<T>, string>,
        )
      }
    })
  }

  #setProducedAndConsumedTagMappings(): void {
    Object.entries(this.energyCapabilityTagMapping).forEach(
      ([capability, tags]: [
        string,
        Extract<keyof EnergyData<T>, string>[],
      ]) => {
        ;(this.producedTagMapping[
          capability as keyof EnergyCapabilityTagMapping<T>
        ] as (keyof EnergyData<T>)[]) = tags.filter(
          (tag) => !tag.endsWith('Consumed'),
        )
        ;(this.consumedTagMapping[
          capability as keyof EnergyCapabilityTagMapping<T>
        ] as (keyof EnergyData<T>)[]) = tags.filter((tag) =>
          tag.endsWith('Consumed'),
        )
      },
    )
  }

  public abstract getRequiredCapabilities(data: ListDeviceData<T>): string[]
}
