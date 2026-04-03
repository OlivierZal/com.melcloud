import { type Homey, Device } from '../lib/homey.mts'
import { getErrorMessage } from '../lib/index.mts'
import { withTimers } from '../mixins/with-timers.mts'
import type { SharedBaseMELCloudDriver } from './shared-base-driver.mts'

const DEBOUNCE_DELAY = 1000

interface FacadeWithSetValues {
  readonly setValues: (data: Record<string, unknown>) => Promise<unknown>
}

export abstract class SharedBaseMELCloudDevice extends withTimers(Device) {
  protected abstract capabilityToDevice: Partial<
    Record<string, (...args: never[]) => unknown>
  >

  protected deviceFacade?: FacadeWithSetValues

  declare public readonly driver: SharedBaseMELCloudDriver

  declare public readonly homey: Homey.Homey

  protected abstract readonly thermostatMode: Record<string, string> | null

  protected get isAlwaysOn(): boolean {
    return Boolean(this.getSetting('always_on'))
  }

  public override onDeleted(): void {
    this.cleanupDevice()
  }

  public override async onInit(): Promise<void> {
    this.applyBaseConverters()
    await this.setWarning(null)
    this.#registerCapabilityListeners()
    await this.initDevice()
  }

  public override async onUninit(): Promise<void> {
    this.onDeleted()
    // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject -- Non-async override must return Promise explicitly
    return Promise.resolve()
  }

  public override async addCapability(capability: string): Promise<void> {
    if (!this.hasCapability(capability)) {
      await super.addCapability(capability)
    }
  }

  public async fetchDevice(): Promise<FacadeWithSetValues | null> {
    try {
      if (!this.deviceFacade) {
        this.deviceFacade = this.getFacade()
        await this.init()
      }
      return this.deviceFacade
    } catch (error) {
      await this.setWarning(error)
      return null
    }
  }

  public override async removeCapability(capability: string): Promise<void> {
    if (this.hasCapability(capability)) {
      await super.removeCapability(capability)
    }
  }

  public override async setWarning(error: unknown): Promise<void> {
    if (error !== null) {
      await super.setWarning(getErrorMessage(error))
    }
    await super.setWarning(null)
  }

  public abstract syncFromDevice(): Promise<void>

  protected applyBaseConverters(): void {
    this.capabilityToDevice = {
      onoff: (isOn: boolean): boolean => this.isAlwaysOn || isOn,
      ...this.capabilityToDevice,
    }
  }

  protected buildUpdateData(
    values: Record<string, unknown>,
  ): Record<string, unknown> {
    this.log('Requested data:', values)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- narrowing Object.fromEntries to Record<string, unknown>
    return Object.fromEntries(
      Object.entries(values).map(([capability, value]) => [
        this.getSetCapabilityTagMapping()[capability],
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- value is cast to never for variadic converter args
        this.capabilityToDevice[capability]?.(value as never) ?? value,
      ]),
    ) as Record<string, unknown>
  }

  protected abstract cleanupDevice(): void

  protected async getDeviceFacade(): Promise<FacadeWithSetValues | null> {
    return this.deviceFacade ?? this.fetchDevice()
  }

  protected abstract getFacade(): FacadeWithSetValues

  protected getRequiredCapabilities(): string[] {
    return this.driver.getRequiredCapabilities()
  }

  protected abstract getSetCapabilityKeys(): string[]

  protected abstract getSetCapabilityTagMapping(): Record<string, string>

  protected async init(): Promise<void> {
    await this.#setCapabilities()
    await this.syncFromDevice()
  }

  protected async initDevice(): Promise<void> {
    await this.fetchDevice()
  }

  protected isManifestCapability(capability: string): boolean {
    /* v8 ignore next -- manifest.capabilities is optional in the Homey SDK type */
    return (this.driver.manifest.capabilities ?? []).includes(capability)
  }

  protected async sendUpdate(values: Record<string, unknown>): Promise<void> {
    const device = await this.getDeviceFacade()
    if (!device) {
      return
    }
    const updateData = this.buildUpdateData(values)
    if (Object.keys(updateData).length > 0) {
      try {
        await device.setValues(updateData)
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'No data to set') {
          await this.setWarning(error)
        }
      }
    }
  }

  #isThermostatModeSupportingOff(): boolean {
    return this.thermostatMode !== null && 'off' in this.thermostatMode
  }

  #registerCapabilityListeners(): void {
    this.registerMultipleCapabilityListener(
      this.getSetCapabilityKeys().filter((capability) =>
        this.hasCapability(capability),
      ),
      async (values) => {
        if (
          'thermostat_mode' in values &&
          this.#isThermostatModeSupportingOff()
        ) {
          const isOn = values['thermostat_mode'] !== 'off'
          values['onoff'] = isOn
          if (!isOn) {
            delete values['thermostat_mode']
          }
        }
        await this.sendUpdate(values)
      },
      DEBOUNCE_DELAY,
    )
  }

  async #setCapabilities(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey SDK getSettings() returns any
    const settings = this.getSettings() as Record<string, unknown>
    const currentCapabilities = new Set(this.getCapabilities())

    const requiredCapabilities = new Set(
      [
        ...Object.keys(settings).filter(
          (setting) => settings[setting] === true,
        ),
        ...this.getRequiredCapabilities(),
      ].filter((capability) => this.isManifestCapability(capability)),
    )

    for (const capability of currentCapabilities.symmetricDifference(
      requiredCapabilities,
    )) {
      // eslint-disable-next-line no-await-in-loop -- Sequential: Homey SDK does not support concurrent capability mutations
      await (requiredCapabilities.has(capability) ?
        this.addCapability(capability)
      : this.removeCapability(capability))
    }
  }
}
