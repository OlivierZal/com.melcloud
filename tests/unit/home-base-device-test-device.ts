import type {
  DeviceFacade,
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeSetCapabilitiesAta,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import { createInstance } from './create-test-instance.ts'

export class TestHomeDevice extends BaseMELCloudDevice {
  public capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {}

  public readonly deviceToCapability: Partial<
    Record<string, HomeConvertFromDevice>
  > = {
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power }) => power,
    target_temperature: ({ setTemperature }) => setTemperature,
    thermostat_mode: ({ operationMode, power }) =>
      power ? operationMode : 'off',
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  declare public readonly getData: () => { id: string }

  public readonly thermostatMode: Record<string, string> | null = null

  public get exposedFacade(): typeof this.cachedFacade {
    return this.cachedFacade
  }

  public override get id(): string {
    return this.getData().id
  }

  public override async syncFromDevice(): Promise<void> {
    const device = await this.fetchDevice()
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    /* v8 ignore next -- cachedFacade is always set before init() calls applyCapabilitiesOptions */
    if (this.cachedFacade && 'capabilities' in this.cachedFacade) {
      await super.applyCapabilitiesOptions(this.cachedFacade.capabilities)
    }
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  protected override getFacade(): ReturnType<
    typeof this.homey.app.getHomeFacade
  > {
    return this.homey.app.getHomeFacade(this.id)
  }

  async #setCapabilityValues(device: DeviceFacade): Promise<void> {
    const converters = Object.entries(this.deviceToCapability) as [
      string,
      (device: DeviceFacade) => unknown,
    ][]
    await Promise.all(
      converters.map(async ([capability, convert]) => {
        /* v8 ignore next -- hasCapability always true in tests */
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, convert(device))
        }
      }),
    )
  }
}

export const createTestHomeDevice = (): TestHomeDevice =>
  createInstance(TestHomeDevice)
