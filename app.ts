import MELCloudAPI, { FacadeManager } from '@olivierzal/melcloud-api'
import 'core-js/actual/object/group-by'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import 'source-map-support/register'

import type { MELCloudDevice } from './types'

import withTimers from './mixins/withTimers'

LuxonSettings.defaultLocale = 'en-us'

export = class MELCloudApp extends withTimers(App) {
  #api!: MELCloudAPI

  #facadeManager!: FacadeManager

  public override async onInit(): Promise<void> {
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    this.#api = await MELCloudAPI.create({
      language: this.homey.i18n.getLanguage(),
      logger: {
        error: (...args): void => {
          this.error(...args)
        },
        log: (...args): void => {
          this.log(...args)
        },
      },
      onSync: async (): Promise<void> => this.#syncFromDevices(),
      settingManager: this.homey.settings,
      timezone: this.homey.clock.getTimezone(),
    })
    this.#facadeManager = new FacadeManager(this.#api)
  }

  public override async onUninit(): Promise<void> {
    this.#api.clearSync()
    return Promise.resolve()
  }

  public get api(): MELCloudAPI {
    return this.#api
  }

  public get facadeManager(): FacadeManager {
    return this.#facadeManager
  }

  public getDevices({
    driverId,
  }: { driverId?: string } = {}): MELCloudDevice[] {
    return (
      driverId === undefined ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap(
      (driver) => driver.getDevices() as MELCloudDevice[],
    )
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
