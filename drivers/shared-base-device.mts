import { type Homey, Device } from '../lib/homey.mts'
import { getErrorMessage } from '../lib/index.mts'
import { withTimers } from '../mixins/with-timers.mts'
import type { SharedBaseMELCloudDriver } from './shared-base-driver.mts'

const DEBOUNCE_DELAY = 1000

export abstract class SharedBaseMELCloudDevice extends withTimers(Device) {
  protected abstract capabilityToDevice: Partial<
    Record<string, (...args: never[]) => unknown>
  >

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

  protected abstract cleanupDevice(): void

  protected abstract getFacade(): unknown

  protected getRequiredCapabilities(): string[] {
    return this.driver.getRequiredCapabilities()
  }

  protected abstract getSetCapabilityKeys(): string[]

  protected async init(): Promise<void> {
    await this.#setCapabilities()
    await this.syncFromDevice()
  }

  protected async initDevice(): Promise<void> {
    try {
      this.getFacade()
      await this.init()
    } catch (error) {
      await this.setWarning(error)
    }
  }

  protected isManifestCapability(capability: string): boolean {
    /* v8 ignore next -- manifest.capabilities is optional in the Homey SDK type */
    return (this.driver.manifest.capabilities ?? []).includes(capability)
  }

  protected abstract sendUpdate(values: Record<string, unknown>): Promise<void>

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
