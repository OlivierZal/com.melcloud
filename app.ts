import 'source-map-support/register'
import 'core-js/actual/object/group-by'
import MELCloudAPI, { type LoginCredentials } from '@olivierzal/melcloud-api'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import type { MELCloudDevice } from './types'
import withTimers from './mixins/withTimers'

export = class MELCloudApp extends withTimers(App) {
  public readonly melcloudAPI = new MELCloudAPI({
    language: this.homey.i18n.getLanguage(),
    logger: {
      error: (...args): void => {
        this.error(...args)
      },
      log: (...args): void => {
        this.log(...args)
      },
    },
    settingManager: this.homey.settings,
    timezone: this.homey.clock.getTimezone(),
  })

  #syncFromDevicesInterval: NodeJS.Timeout | null = null

  public async applyLogin(data?: LoginCredentials): Promise<boolean> {
    if (typeof data !== 'undefined') {
      this.#clearSyncFromDevices()
    }
    return this.melcloudAPI.applyLogin(
      data,
      async (): Promise<void> => this.#runSyncFromDevices(),
    )
  }

  public getDevices({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): MELCloudDevice[] {
    const devices = (
      typeof driverId === 'undefined' ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap(
      (driver) => driver.getDevices() as MELCloudDevice[],
    )
    if (typeof buildingId !== 'undefined') {
      return devices.filter(({ buildingId: id }) => id === buildingId)
    }
    return devices
  }

  public override async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.applyLogin()
  }

  #clearSyncFromDevices(): void {
    this.homey.clearInterval(this.#syncFromDevicesInterval)
    this.#syncFromDevicesInterval = null
    this.log('Device list refresh has been paused')
  }

  async #runSyncFromDevices(): Promise<void> {
    if (!this.#syncFromDevicesInterval) {
      this.#clearSyncFromDevices()
      await this.#syncFromDeviceList()
      this.#syncFromDevicesInterval = this.setInterval(
        async (): Promise<void> => {
          await this.#syncFromDeviceList()
        },
        { minutes: 5 },
        { actionType: 'device list refresh', units: ['minutes'] },
      )
    }
  }

  async #syncFromDeviceList(): Promise<void> {
    try {
      await this.melcloudAPI.fetchDevices()
      await this.#syncFromDevices()
    } catch (_error) {}
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
