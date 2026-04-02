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
import { SharedMELCloudDevice } from './base-device-shared.mts'

@addToLogs('getName()')
export abstract class HomeBaseMELCloudDevice extends SharedMELCloudDevice {
  #device?: HomeDeviceAtaFacade

  readonly #setCapabilityKeys = Object.keys(homeSetCapabilityTagMappingAta)

  protected abstract capabilityToDevice: Partial<
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

  public async syncFromDevice(): Promise<void> {
    const device = await this.#fetchDevice()
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  protected override applyDefaultConverters(): void {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.alwaysOn || isOn,
      ...this.capabilityToDevice,
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override cleanupDevice(): void {
    // No energy reports to unschedule
  }

  protected override getSetCapabilityKeys(): string[] {
    return this.#setCapabilityKeys
  }

  protected override async initDevice(): Promise<void> {
    await this.syncFromDevice()
  }

  protected override async sendUpdate(
    values: Record<string, unknown>,
  ): Promise<void> {
    await this.#set(values as Partial<HomeSetCapabilitiesAta>)
  }

  async #fetchDevice(): Promise<HomeDeviceAtaFacade | null> {
    try {
      this.#device = await this.homey.app.getHomeFacade(this.id)
      return this.#device
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  async #set(values: Partial<HomeSetCapabilitiesAta>): Promise<void> {
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
}
