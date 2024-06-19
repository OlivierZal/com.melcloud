import 'source-map-support/register'
import 'core-js/actual/object/group-by'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from '@olivierzal/melcloud-api'
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
    syncFunction: async (): Promise<void> => this.#syncFromDevices(),
    timezone: this.homey.clock.getTimezone(),
  })

  public getDevices({
    driverId,
  }: { driverId?: string } = {}): MELCloudDevice[] {
    return (
      typeof driverId === 'undefined' ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap(
      (driver) => driver.getDevices() as MELCloudDevice[],
    )
  }

  public override async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.melcloudAPI.applyLogin()
  }

  public override async onUninit(): Promise<void> {
    this.melcloudAPI.clearSync()
    return Promise.resolve()
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
