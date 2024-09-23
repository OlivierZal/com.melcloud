import MELCloudAPI, { FacadeManager } from '@olivierzal/melcloud-api'
import 'core-js/actual/object/group-by'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import 'source-map-support/register'

import type { MELCloudDevice, Manifest } from './types'

import changelog from './.homeychangelog.json'
import withTimers from './mixins/withTimers'

LuxonSettings.defaultLocale = 'en-us'

const NOTIFICATION_DELAY = 10000

export = class extends withTimers(App) {
  #api!: MELCloudAPI

  #facadeManager!: FacadeManager

  public override async onInit(): Promise<void> {
    const language = this.homey.i18n.getLanguage()
    const timezone = this.homey.clock.getTimezone()
    LuxonSettings.defaultLocale = language
    LuxonSettings.defaultZone = timezone
    this.#api = await MELCloudAPI.create({
      language,
      logger: {
        error: (...args) => {
          this.error(...args)
        },
        log: (...args) => {
          this.log(...args)
        },
      },
      onSync: async () => this.#syncFromDevices(),
      settingManager: this.homey.settings,
      timezone,
    })
    this.#facadeManager = new FacadeManager(this.#api)
    this.#createNotification(language)
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

  public override async onUninit(): Promise<void> {
    this.#api.clearSync()
    return Promise.resolve()
  }

  #createNotification(language: string): void {
    const { version } = this.homey.manifest as Manifest
    if (version in changelog) {
      const versionChangelog = changelog[version as keyof typeof changelog]
      this.homey.setTimeout(() => {
        this.homey.notifications
          .createNotification({
            excerpt:
              versionChangelog[
                language in versionChangelog ?
                  (language as keyof typeof versionChangelog)
                : 'en'
              ],
          })
          .catch(() => {
            //
          })
      }, NOTIFICATION_DELAY)
    }
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
