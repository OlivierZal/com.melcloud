import type PairSession from 'homey/lib/PairSession'
import {
  type DeviceType,
  type LoginCredentials,
  AuthenticationError,
  RegistrySyncError,
} from '@olivierzal/melcloud-api'

import type { AuthenticationAPI } from '../types/api.mts'
import type { ManifestDriver } from '../types/manifest.mts'
import { type Homey, Driver } from '../lib/homey.mts'

const NOT_FOUND = -1

const getArg = (capability: string): string => {
  const dot = capability.indexOf('.')
  return dot === NOT_FOUND ? capability : capability.slice(0, dot)
}

export abstract class BaseMELCloudDriver extends Driver {
  declare public readonly homey: Homey.Homey

  declare public readonly manifest: ManifestDriver

  protected abstract readonly api: AuthenticationAPI

  public abstract readonly type: DeviceType

  public readonly tagMappings: {
    readonly energy: Readonly<Record<string, readonly string[]>>
    readonly get: Readonly<Record<string, string>>
    readonly list: Readonly<Record<string, string>>
    readonly set: Readonly<Record<string, string>>
  } = { energy: {}, get: {}, list: {}, set: {} }

  public override async onInit(): Promise<void> {
    this.#registerFlowListeners()
    await Promise.resolve()
  }

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view !== 'loading') {
        return
      }

      if (this.api.isAuthenticated()) {
        await session.showView('list_devices')
        return
      }
      await session.showView('login')
    })
    this.#registerLoginHandler(session)
    session.setHandler('list_devices', async () => this.discoverDevices())
    await Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    this.#registerLoginHandler(session)
    await Promise.resolve()
  }

  protected abstract getDeviceModels(): { id: number | string; name: string }[]

  protected abstract toDeviceDetails(model: {
    id: number | string
    name: string
  }): { data: { id: number | string }; name: string }

  protected async discoverDevices(): Promise<
    { data: { id: number | string }; name: string }[]
  > {
    await Promise.resolve()
    return this.getDeviceModels().map((model) => this.toDeviceDetails(model))
  }

  #registerActionListener(capability: string): void {
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
  }

  #registerConditionListener(capability: string): void {
    this.homey.flow
      .getConditionCard(`${capability}_condition`)
      .registerRunListener(
        (
          args: Record<string, unknown> & {
            device: { getCapabilityValue: (key: string) => unknown }
          },
        ) => {
          const value = args.device.getCapabilityValue(capability)
          return typeof value === 'string' || typeof value === 'number'
            ? value === args[getArg(capability)]
            : value
        },
      )
  }

  // Run listeners are wired for exactly the cards the app manifest
  // declares, so a missing card is a contract break, never a swallowed
  // throw. An action card also needs a write mapping: the listener
  // forwards the argument to the capability listener, which only the
  // set-mapped capabilities carry.
  #registerFlowListeners(): void {
    const { actions, conditions } = this.homey.manifest.flow
    const conditionIds = new Set(conditions.map(({ id }) => id))
    const actionIds = new Set(actions.map(({ id }) => id))
    for (const capability of this.manifest.capabilities) {
      if (conditionIds.has(`${capability}_condition`)) {
        this.#registerConditionListener(capability)
      }
      if (
        Object.hasOwn(this.tagMappings.set, capability) &&
        actionIds.has(`${capability}_action`)
      ) {
        this.#registerActionListener(capability)
      }
    }
  }

  #registerLoginHandler(session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => {
      try {
        await this.api.authenticate(data)
        return true
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return false
        }
        // The library enforces a registry sync AFTER the server
        // accepted the sign-in and wraps that failure as its own TYPE:
        // a `RegistrySyncError` means the account IS signed in, so
        // pairing continues to the device list instead of failing the
        // wizard. Anything else is a login failure — consulting the
        // session here read "signed in" on a transport failure over a
        // pre-existing live session.
        if (error instanceof RegistrySyncError) {
          return true
        }
        throw error
      }
    })
  }
}
