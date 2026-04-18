import type { DeviceType } from '@olivierzal/melcloud-api'
import type * as Classic from '@olivierzal/melcloud-api/classic'
import type PairSession from 'homey/lib/PairSession'

import type { AuthAPI } from '../types/device.mts'
import type { ManifestDriver } from '../types/manifest.mts'
import { type Homey, Driver } from '../lib/homey.mts'

const getArg = (capability: string): string => {
  const [arg = capability] = capability.split('.')
  return arg
}

const tryRegisterFlowCard = (register: () => void): void => {
  try {
    register()
  } catch {
    // Flow card may not exist for this capability
  }
}

export abstract class BaseMELCloudDriver extends Driver {
  declare public readonly homey: Homey.Homey

  declare public readonly manifest: ManifestDriver

  protected abstract readonly api: AuthAPI

  public abstract readonly type: DeviceType

  public readonly energyCapabilityTagMapping: Readonly<
    Record<string, readonly string[]>
  > = {}

  public readonly getCapabilityTagMapping: Readonly<Record<string, string>> = {}

  public readonly listCapabilityTagMapping: Readonly<Record<string, string>> =
    {}

  public readonly setCapabilityTagMapping: Readonly<Record<string, string>> = {}

  public override async onInit(): Promise<void> {
    this.#registerFlowListeners()
    await Promise.resolve()
  }

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        if (this.api.isAuthenticated()) {
          await session.showView('list_devices')
          return
        }
        await session.showView('login')
      }
    })
    this.#registerLoginHandler(session)
    session.setHandler('list_devices', async () => this.discoverDevices())
    await Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    this.#registerLoginHandler(session)
    await Promise.resolve()
  }

  protected abstract getDeviceModels(): {
    id: number | string
    name: string
  }[]

  /* v8 ignore start -- @preserve, default implementation; always overridden by classic or test mock */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- polymorphic default; overridden by subclasses that use this
  public getCapabilitiesOptions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- signature must match overrides that use this parameter
    ..._data: unknown[]
  ): Partial<Record<string, unknown>> {
    return {}
  }
  /* v8 ignore stop -- @preserve */

  public getRequiredCapabilities(): string[] {
    return [...this.manifest.capabilities]
  }

  protected async discoverDevices(): Promise<
    { data: { id: number | string }; name: string }[]
  > {
    await Promise.resolve()
    return this.getDeviceModels().map((model) => this.toDeviceDetails(model))
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- default mapping; overridden in classic to add capabilities
  protected toDeviceDetails({
    id,
    name,
  }: {
    id: number | string
    name: string
  }): { data: { id: number | string }; name: string } {
    return { data: { id }, name }
  }

  #registerFlowListeners(): void {
    for (const capability of this.manifest.capabilities) {
      tryRegisterFlowCard(() => {
        this.homey.flow
          .getConditionCard(`${capability}_condition`)
          .registerRunListener(
            (
              args: Record<string, unknown> & {
                device: { getCapabilityValue: (key: string) => unknown }
              },
            ) => {
              const value = args.device.getCapabilityValue(capability)
              return typeof value === 'string' || typeof value === 'number' ?
                  value === args[getArg(capability)]
                : value
            },
          )
      })
      if (capability in this.setCapabilityTagMapping) {
        tryRegisterFlowCard(() => {
          this.homey.flow
            .getActionCard(`${capability}_action`)
            .registerRunListener(
              async (
                args: Record<string, unknown> & {
                  device: {
                    triggerCapabilityListener: (
                      key: string,
                      value: unknown,
                    ) => Promise<void>
                  }
                },
              ) => {
                await args.device.triggerCapabilityListener(
                  capability,
                  args[getArg(capability)],
                )
              },
            )
        })
      }
    }
  }

  #registerLoginHandler(session: PairSession): void {
    session.setHandler('login', async (data: Classic.LoginCredentials) =>
      this.api.authenticate(data),
    )
  }
}
