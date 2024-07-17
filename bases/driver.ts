import type {
  Capabilities,
  CapabilitiesOptions,
  DeviceDetails,
  EnergyCapabilityTagMapping,
  FlowArgs,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  ManifestDriver,
  SetCapabilities,
  SetCapabilityTagMapping,
} from '../types'
import {
  DeviceModel,
  type DeviceType,
  type EnergyData,
  type ListDevice,
  type LoginCredentials,
} from '@olivierzal/melcloud-api'
import type BaseMELCloudDevice from './device'
import { Driver } from 'homey'
import type MELCloudApp from '..'
import type PairSession from 'homey/lib/PairSession'

const getArg = <T extends keyof typeof DeviceType>(
  capability: Extract<keyof Capabilities[T], string>,
): keyof FlowArgs[T] => {
  const [arg] = capability.split('.')
  return arg.replace(/_with_cool$/u, '') as keyof FlowArgs[T]
}

const getCapabilitiesOptions = <T extends keyof typeof DeviceType>(
  device: ListDevice[T]['Device'],
): CapabilitiesOptions[T] =>
  ('NumberOfFanSpeeds' in device ?
    {
      fan_power: {
        max: device.NumberOfFanSpeeds,
        min: Number(!device.HasAutomaticFanSpeed),
        step: 1,
      },
    }
  : {}) as CapabilitiesOptions[T]

export default abstract class<
  T extends keyof typeof DeviceType,
> extends Driver {
  public readonly capabilities = (this.manifest as ManifestDriver).capabilities

  public readonly consumedTagMapping: Partial<EnergyCapabilityTagMapping[T]> =
    {}

  public readonly producedTagMapping: Partial<EnergyCapabilityTagMapping[T]> =
    {}

  readonly #api = (this.homey.app as MELCloudApp).api

  public abstract readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping[T]

  public abstract readonly getCapabilityTagMapping: GetCapabilityTagMapping[T]

  public abstract readonly listCapabilityTagMapping: ListCapabilityTagMapping[T]

  public abstract readonly setCapabilityTagMapping: SetCapabilityTagMapping[T]

  protected abstract readonly type: T

  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    return Promise.resolve()
  }

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        if (await this.#api.applyLogin()) {
          await session.showView('list_devices')
          return
        }
        await session.showView('login')
      }
    })
    session.setHandler('login', async (data: LoginCredentials) =>
      this.#api.applyLogin(data),
    )
    session.setHandler('list_devices', async () => this.#discoverDevices())
    return Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.#api.applyLogin(data),
    )
    return Promise.resolve()
  }

  async #discoverDevices(): Promise<DeviceDetails<T>[]> {
    return Promise.resolve(
      DeviceModel.getByType(this.type).map(({ data, id, name }) => ({
        capabilities: this.getRequiredCapabilities(data),
        capabilitiesOptions: getCapabilitiesOptions(data),
        data: { id },
        name,
      })),
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
    } catch (_error) {}
  }

  #registerConditionRunListener(
    capability: Extract<keyof Capabilities[T], string>,
  ): void {
    try {
      this.homey.flow
        .getConditionCard(`${capability}_condition`)
        .registerRunListener((args: FlowArgs[T]) => {
          const value = (
            args.device as unknown as BaseMELCloudDevice<T>
          ).getCapabilityValue(capability)
          return typeof value === 'boolean' ? value : (
              (value as number | string) === args[getArg(capability)]
            )
        })
    } catch (_error) {}
  }

  #registerRunListeners(): void {
    Object.keys({
      ...this.setCapabilityTagMapping,
      ...this.getCapabilityTagMapping,
      ...this.listCapabilityTagMapping,
    }).forEach((capability) => {
      this.#registerConditionRunListener(
        capability as Extract<keyof Capabilities[T], string>,
      )
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          capability as Extract<keyof SetCapabilities[T], string>,
        )
      }
    })
  }

  #setProducedAndConsumedTagMappings(): void {
    Object.entries(this.energyCapabilityTagMapping).forEach(
      ([capability, tags]: [
        string,
        Extract<keyof EnergyData[T], string>[],
      ]) => {
        ;(this.producedTagMapping[
          capability as keyof EnergyCapabilityTagMapping[T]
        ] as Extract<keyof EnergyData[T], string>[]) = tags.filter(
          (tag) => !tag.endsWith('Consumed'),
        )
        ;(this.consumedTagMapping[
          capability as keyof EnergyCapabilityTagMapping[T]
        ] as Extract<keyof EnergyData[T], string>[]) = tags.filter((tag) =>
          tag.endsWith('Consumed'),
        )
      },
    )
  }

  public abstract getRequiredCapabilities(
    data: ListDevice[T]['Device'],
  ): string[]
}
