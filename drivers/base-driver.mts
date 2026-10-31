import type PairSession from 'homey/lib/PairSession'
import {
  type DeviceType,
  type LoginCredentials,
  AuthenticationError,
  RegistrySyncError,
} from '@olivierzal/melcloud-api'

import type { Api, AuthenticationAPI } from '../types/api.mts'
import type { ManifestDriver } from '../types/manifest.mts'
import { type Homey, Driver } from '../lib/homey.mts'

export abstract class BaseMELCloudDriver extends Driver {
  declare public readonly homey: Homey.Homey

  declare public readonly manifest: ManifestDriver

  // The account this driver pairs from: names the registry its pairing
  // consults (see `onPair`).
  protected abstract readonly api: Api

  protected abstract readonly client: AuthenticationAPI

  public abstract readonly type: DeviceType

  public readonly tagMappings: {
    readonly energy: Readonly<Record<string, readonly string[]>>
    readonly get: Readonly<Record<string, string>>
    readonly list: Readonly<Record<string, string>>
    readonly set: Readonly<Record<string, string>>
  } = { energy: {}, get: {}, list: {}, set: {} }

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view !== 'loading') {
        return
      }

      if (this.client.isAuthenticated()) {
        await session.showView('list_devices')
        return
      }
      await session.showView('login')
    })
    this.#registerLoginHandler(session)
    session.setHandler('list_devices', async () => {
      // An account that lists no unit at all is answered with where its
      // units may be, which Homey shows in place of the empty list. Only a
      // listed registry answers so: a session whose first sync has not
      // landed yet still gets the plain list.
      if (this.homey.app.isAccountEmpty(this.api)) {
        throw new Error(this.homey.__(`pair.accountEmpty.${this.api}`))
      }
      return this.discoverDevices()
    })
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

  #registerLoginHandler(session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) => {
      try {
        await this.client.authenticate(data)
        return true
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return this.#rejectCredentials()
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

  // A refused credential fails the login — unless the app judges the
  // wizard opened on the wrong dialect's driver (this account holds no
  // device in Homey while the OTHER one is signed in and lists units):
  // the thrown message names that account's devices, and Homey shows it
  // in place of its generic failure. A repair never qualifies, since the
  // device under repair is this account's.
  #rejectCredentials(): boolean {
    if (this.homey.app.isPairingMisdirected(this.api)) {
      throw new Error(this.homey.__(`pair.rejected.${this.api}`))
    }
    return false
  }
}
