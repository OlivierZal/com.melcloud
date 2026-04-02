import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type PairSession from 'homey/lib/PairSession'

import type { ManifestDriver } from '../types/index.mts'
import { type Homey, Driver } from '../lib/homey.mts'

interface AuthAPI {
  readonly authenticate: (data?: LoginCredentials) => Promise<boolean>
  readonly isAuthenticated: () => boolean
}

export abstract class SharedBaseMELCloudDriver extends Driver {
  protected abstract readonly api: AuthAPI

  declare public readonly homey: Homey.Homey

  declare public readonly manifest: ManifestDriver

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
    session.setHandler('login', async (data: LoginCredentials) =>
      this.api.authenticate(data),
    )
    session.setHandler('list_devices', async () => this.discoverDevices())
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.api.authenticate(data),
    )
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public getRequiredCapabilities(): string[] {
    return [...(this.manifest.capabilities ?? [])]
  }

  protected abstract discoverDevices(): Promise<
    { data: { id: number | string }; name: string }[]
  >
}
