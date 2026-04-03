import type { DeviceFacade } from '../types/index.mts'
import { addToLogs } from '../decorators/add-to-logs.mts'
import { SharedBaseMELCloudDevice } from './shared-base-device.mts'

@addToLogs('getName()')
export abstract class HomeBaseMELCloudDevice extends SharedBaseMELCloudDevice {
  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  declare public readonly getData: () => { id: string }

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

  async #setCapabilityValues(device: DeviceFacade): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Home converters accept DeviceFacade; shared type is (...args: never[]) for compatibility
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
