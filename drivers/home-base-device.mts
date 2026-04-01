import type {
  HomeAtaValues,
  HomeDeviceAtaFacade,
} from '@olivierzal/melcloud-api'

import { addToLogs } from '../decorators/add-to-logs.mts'
import {
  type HomeSetCapabilitiesAta,
  homeSetCapabilityTagMappingAta,
} from '../types/index.mts'
import { SharedMELCloudDevice } from './base-device-shared.mts'

@addToLogs('getName()')
export abstract class HomeBaseMELCloudDevice extends SharedMELCloudDevice {
  #facade?: HomeDeviceAtaFacade

  readonly #setCapabilityKeys = Object.keys(homeSetCapabilityTagMappingAta)

  protected abstract capabilityToDevice: Partial<
    Record<
      keyof HomeSetCapabilitiesAta,
      (value: never) => HomeAtaValues[keyof HomeAtaValues]
    >
  >

  protected abstract readonly deviceToCapability: Partial<
    Record<string, (facade: HomeDeviceAtaFacade) => unknown>
  >

  protected get facade(): HomeDeviceAtaFacade | undefined {
    return this.#facade
  }

  public get id(): string {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (this.getData() as { id: string }).id
  }

  public override async onInit(): Promise<void> {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean =>
        Boolean(this.getSetting('always_on')) || isOn,
      ...this.capabilityToDevice,
    }
    await super.onInit()
  }

  public async syncFromDevice(): Promise<void> {
    const facade = await this.#fetchDevice()
    if (facade) {
      await this.#setCapabilityValues(facade)
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
      this.#facade = await this.homey.app.getHomeFacade(this.id)
      return this.#facade
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  async #set(values: Partial<HomeSetCapabilitiesAta>): Promise<void> {
    const facade = this.#facade ?? (await this.#fetchDevice())
    if (!facade) {
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
        await facade.setValues(homeValues)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'No data to set') {
          await this.setWarning(error)
        }
      }
    }
  }

  async #setCapabilityValues(facade: HomeDeviceAtaFacade): Promise<void> {
    this.homey.api.realtime('deviceupdate', null)
    const defaultMappings: Record<string, () => unknown> = {
      measure_temperature: (): number => facade.roomTemperature,
      onoff: (): boolean => facade.power,
      target_temperature: (): number => facade.setTemperature,
      thermostat_mode: (): string =>
        facade.power ? facade.operationMode : 'off',
    }
    const allMappings: Record<string, () => unknown> = {
      ...defaultMappings,
      ...Object.fromEntries(
        Object.entries(this.deviceToCapability)
          .filter(
            (
              entry,
            ): entry is [string, (facade: HomeDeviceAtaFacade) => unknown] =>
              entry[1] !== undefined,
          )
          .map(([capability, convert]) => [
            capability,
            (): unknown => convert(facade),
          ]),
      ),
    }
    await Promise.all(
      Object.entries(allMappings).map(async ([capability, getValue]) => {
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, getValue())
        }
      }),
    )
  }
}
