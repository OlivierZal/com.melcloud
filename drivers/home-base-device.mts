import type {
  HomeAtaValues,
  HomeDeviceAtaFacade,
} from '@olivierzal/melcloud-api'

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
  #device?: HomeDeviceAtaFacade

  readonly #setCapabilityKeys = Object.keys(homeSetCapabilityTagMappingAta)

  protected abstract override capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<keyof HomeCapabilitiesAta, HomeConvertFromDevice>
  >

  protected get facade(): HomeDeviceAtaFacade | undefined {
    return this.#device
  }

  public get id(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (this.getData() as { id: string }).id
  }

  public override async syncFromDevice(): Promise<void> {
    const device = this.#device ?? (await this.#fetchDevice())
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override cleanupDevice(): void {
    // No energy reports to unschedule
  }

  protected override getFacade(): HomeDeviceAtaFacade {
    this.#device = this.homey.app.getHomeFacade(this.id)
    return this.#device
  }

  protected override getSetCapabilityKeys(): string[] {
    return this.#setCapabilityKeys
  }

  protected override async sendUpdate(
    values: Record<string, unknown>,
  ): Promise<void> {
    await this.#setDeviceValues(values as Partial<HomeSetCapabilitiesAta>)
  }

  async #fetchDevice(): Promise<HomeDeviceAtaFacade | null> {
    try {
      this.#device = this.homey.app.getHomeFacade(this.id)
      return this.#device
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  async #setCapabilityValues(device: HomeDeviceAtaFacade): Promise<void> {
    await Promise.all(
      Object.entries(this.deviceToCapability).map(
        async ([capability, convert]) => {
          if (convert && this.hasCapability(capability)) {
            await this.setCapabilityValue(capability, convert(device))
          }
        },
      ),
    )
  }

  async #setDeviceValues(
    values: Partial<HomeSetCapabilitiesAta>,
  ): Promise<void> {
    const device = this.#device ?? (await this.#fetchDevice())
    if (!device) {
      return
    }
    this.log('Requested data:', values)
    const homeValues = Object.fromEntries(
      Object.entries(values).map(([capability, value]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        const key = capability as keyof HomeSetCapabilitiesAta
        return [
          homeSetCapabilityTagMappingAta[key],
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
          this.capabilityToDevice[key]?.(value as never) ?? value,
        ]
      }),
    ) as HomeAtaValues
    if (Object.keys(homeValues).length > 0) {
      try {
        await device.setValues(homeValues)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'No data to set') {
          await this.setWarning(error)
        }
      }
    }
  }
}
