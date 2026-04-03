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
    const device = await this.getDeviceFacade()
    if (device) {
      await this.#setCapabilityValues(device)
    }
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  /* v8 ignore start -- Home overrides syncFromDevice; operationalCapabilityTagEntries is unused */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override getGetCapabilityTagMapping(): Record<string, string> {
    return {}
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  protected override getListCapabilityTagMapping(): Record<string, string> {
    return {}
  }
  /* v8 ignore stop */

  async #setCapabilityValues(device: DeviceFacade): Promise<void> {
    await Promise.all(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Home converters accept DeviceFacade; shared type is (...args: never[]) for compatibility
      (
        Object.entries(this.deviceToCapability) as [
          string,
          (device: DeviceFacade) => unknown,
        ][]
      ).map(async ([capability, convert]) => {
        /* v8 ignore next -- hasCapability always true in tests */
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, convert(device))
        }
      }),
    )
  }
}
