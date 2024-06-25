import 'source-map-support/register'
import 'core-js/actual/object/group-by'
import MELCloudAPI, { FacadeManager } from '@olivierzal/melcloud-api'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import type { MELCloudDevice } from './types'
import withTimers from './mixins/withTimers'

LuxonSettings.defaultLocale = 'en-us'

export = class MELCloudApp extends withTimers(App) {
  public api!: MELCloudAPI

  public readonly facadeManager = new FacadeManager(this.api)

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
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    this.api = await MELCloudAPI.create({
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
  }

  public override async onUninit(): Promise<void> {
    this.api.clearSync()
    return Promise.resolve()
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
