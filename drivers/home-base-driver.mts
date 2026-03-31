import type { LoginCredentials } from '@olivierzal/melcloud-api'
import type PairSession from 'homey/lib/PairSession'

import { type Homey, Driver } from '../lib/homey.mts'

export class HomeBaseMELCloudDriver extends Driver {
  declare public readonly homey: Homey.Homey

  public override async onPair(session: PairSession): Promise<void> {
    session.setHandler('showView', async (view) => {
      if (view === 'loading') {
        if (this.homey.app.homeApi.isAuthenticated()) {
          await session.showView('list_devices')
          return
        }
        await session.showView('login')
      }
    })
    session.setHandler('login', async (data: LoginCredentials) =>
      this.homey.app.homeApi.authenticate(data),
    )
    session.setHandler('list_devices', async () => this.#discoverDevices())
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async onRepair(session: PairSession): Promise<void> {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.homey.app.homeApi.authenticate(data),
    )
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  async #discoverDevices(): Promise<{ data: { id: string }; name: string }[]> {
    const devices = await this.homey.app.getHomeDevices()
    return devices.map((device) => ({
      data: { id: device.id },
      name: device.givenDisplayName,
    }))
  }
}
