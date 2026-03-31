import { type Homey, Device } from '../lib/homey.mts'
import { getErrorMessage } from '../lib/index.mts'
import { withTimers } from '../mixins/with-timers.mts'

const DEBOUNCE_DELAY = 1000

export abstract class SharedMELCloudDevice extends withTimers(Device) {
  declare public readonly homey: Homey.Homey

  protected abstract readonly thermostatMode: Record<string, string> | null

  public override onDeleted(): void {
    this.cleanupDevice()
  }

  public override async onInit(): Promise<void> {
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

  protected abstract cleanupDevice(): void

  protected abstract getSetCapabilityKeys(): string[]

  protected abstract initDevice(): Promise<void>

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
}
