import type PairSession from 'homey/lib/PairSession'
import {
  type DeviceType,
  type LoginCredentials,
  AuthenticationError,
} from '@olivierzal/melcloud-api'

import type { AuthenticationAPI } from '../types/api.mts'
import type { ManifestDriver } from '../types/manifest.mts'
import { type Homey, Driver } from '../lib/homey.mts'

const getArg = (capability: string): string =>
  capability.includes('.') ?
    capability.slice(0, capability.indexOf('.'))
  : capability

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

  protected abstract getDeviceModels(): {
    id: number | string
    name: string
  }[]

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
      if (Object.hasOwn(this.tagMappings.set, capability)) {
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
    session.setHandler('login', async (data: LoginCredentials) => {
      try {
        await this.api.authenticate(data)
        return true
      } catch (error) {
        if (!(error instanceof AuthenticationError)) {
          throw error
        }
        return false
      }
    })
  }
}
