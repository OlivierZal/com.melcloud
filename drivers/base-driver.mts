import {
  DeviceModel,
  type DeviceType,
  type ListDeviceData,
  type LoginCredentials,
} from '@olivierzal/melcloud-api'
// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey'

import type PairSession from 'homey/lib/PairSession.js'

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
} from '../types/common.mts'

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

  public override async onInit(): Promise<void> {
    this.#setProducedAndConsumedTagMappings()
    this.#registerRunListeners()
    this.#registerHolidayModeFlowActions()
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
    ;(
      Object.keys({
        ...this.setCapabilityTagMapping,
        ...this.getCapabilityTagMapping,
        ...this.listCapabilityTagMapping,
      }) as (string & keyof OpCapabilities<T>)[]
    ).forEach((capability) => {
      this.#registerConditionRunListener(capability)
      if (capability in this.setCapabilityTagMapping) {
        this.#registerActionRunListener(
          capability as string & keyof SetCapabilities<T>,
        )
      }
    })
  }

  #setProducedAndConsumedTagMappings(): void {
    Object.entries(this.energyCapabilityTagMapping).forEach(
      ([capability, tags]) => {
        const { consumed = [], produced = [] } = Object.groupBy(tags, (tag) =>
          (tag as string).endsWith('Consumed') ? 'consumed' : 'produced',
        )
        this.consumedTagMapping[
          capability as keyof EnergyCapabilityTagMapping<T>
        ] = consumed
        this.producedTagMapping[
          capability as keyof EnergyCapabilityTagMapping<T>
        ] = produced
      },
    )
  }

  #registerHolidayModeFlowActions(): void {
    try {
      this.homey.flow
        .getActionCard('holiday_mode_on_action')
        .registerRunListener(async (args: any) => {
          const { device, end_date, start_date } = args
          await this.homey.app.setHolidayModeSettings(
            {
              from: start_date ?? undefined,
              to: end_date,
            },
            { zoneId: device.id, zoneType: 'devices' },
          )
          return true
        })
      
      this.homey.flow
        .getActionCard('holiday_mode_off_action')
        .registerRunListener(async (args: any) => {
          const { device } = args
          await this.homey.app.setHolidayModeSettings(
            {
              from: undefined,
              to: undefined,
            },
            { zoneId: device.id, zoneType: 'devices' },
          )
          return true
        })
    } catch {
      // Silently catch errors during registration (similar to other methods)
    }
  }

  public abstract getRequiredCapabilities(data: ListDeviceData<T>): string[]
}
