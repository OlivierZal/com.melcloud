import type {
  DeviceType,
  HomeDeviceType,
  LoginCredentials,
} from '@olivierzal/melcloud-api'
import type PairSession from 'homey/lib/PairSession'

import type { AuthAPI, ManifestDriver } from '../types/index.mts'
import { type Homey, Driver } from '../lib/homey.mts'

export abstract class SharedBaseMELCloudDriver extends Driver {
  protected abstract readonly api: AuthAPI

  public readonly energyCapabilityTagMapping: Record<string, unknown> = {}

  public readonly getCapabilityTagMapping: Record<string, unknown> = {}

  declare public readonly homey: Homey.Homey

  public readonly listCapabilityTagMapping: Record<string, unknown> = {}

  declare public readonly manifest: ManifestDriver

  public readonly setCapabilityTagMapping: Record<string, unknown> = {}

  public abstract readonly type: DeviceType | HomeDeviceType

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

  #registerLoginHandler(session: PairSession): void {
    session.setHandler('login', async (data: LoginCredentials) =>
      this.api.authenticate(data),
    )
  }

  /* v8 ignore start -- default implementation; always overridden by classic or test mock */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  public getCapabilitiesOptions(
    ..._context: unknown[]
  ): Partial<Record<string, unknown>> {
    return {}
  }
  /* v8 ignore stop */

  public getRequiredCapabilities(): string[] {
    /* v8 ignore next -- manifest.capabilities is optional and readonly in Homey SDK type */
    return [...(this.manifest.capabilities ?? [])]
  }

  protected async discoverDevices(): Promise<
    { data: { id: number | string }; name: string }[]
  > {
    await Promise.resolve()
    return this.getDeviceModels().map((model) => this.toDeviceDetails(model))
  }

  protected abstract getDeviceModels(): {
    id: number | string
    name: string
  }[]

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
}
