import type { HomeDeviceAtaFacade } from '@olivierzal/melcloud-api'

import { addToLogs } from '../decorators/add-to-logs.mts'
import {
  type HomeCapabilitiesAta,
  type HomeConvertFromDevice,
  type HomeConvertToDevice,
  type HomeSetCapabilitiesAta,
  homeSetCapabilityTagMappingAta,
} from '../types/index.mts'
import { SharedBaseMELCloudDevice } from './shared-base-device.mts'

@addToLogs('getName()')
export abstract class HomeBaseMELCloudDevice extends SharedBaseMELCloudDevice {
  readonly #setCapabilityKeys = Object.keys(homeSetCapabilityTagMappingAta)

  protected abstract override capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<keyof HomeCapabilitiesAta, HomeConvertFromDevice>
  >

  public get id(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey SDK getData returns untyped device data
    return (this.getData() as { id: string }).id
  }

  public override async syncFromDevice(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing from base FacadeWithSetValues
    const device = (await this.getDeviceFacade()) as HomeDeviceAtaFacade | null
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- no-op: Home has no energy reports to unschedule
  protected override cleanupDevice(): void {
    // No energy reports to unschedule
  }

  protected override getFacade(): HomeDeviceAtaFacade {
    return this.homey.app.getHomeFacade(this.id)
  }

  protected override getSetCapabilityKeys(): string[] {
    return this.#setCapabilityKeys
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- returns module-level constant, no instance state needed
  protected override getSetCapabilityTagMapping(): Record<string, string> {
    return homeSetCapabilityTagMappingAta
  }

  async #setCapabilityValues(device: HomeDeviceAtaFacade): Promise<void> {
    await Promise.all(
      Object.entries(this.deviceToCapability).map(
        async ([capability, convert]) => {
          /* v8 ignore next -- convert is always defined: deviceToCapability has no undefined values */
          if (convert && this.hasCapability(capability)) {
            await this.setCapabilityValue(capability, convert(device))
          }
        },
      ),
    )
  }
}
