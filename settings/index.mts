import type Homey from 'homey/lib/HomeySettings'

import type { BuildingZone, HomeySettings } from '../types/index.mts'

import { getButtonElement } from './dom.mts'

import { getErrorMessage, homeyApiGet } from './api.mts'
import { AuthManager } from './auth.mts'
import { DeviceSettingsManager } from './device-settings.mts'
import { disableButton, NoDeviceError } from './dom-helpers.mts'
import { ErrorLogManager } from './error-log.mts'
import { ZoneSettingsManager } from './zone-settings.mts'

class SettingsApp {
  readonly #authManager: AuthManager

  readonly #deviceSettingsManager: DeviceSettingsManager

  readonly #errorLogManager: ErrorLogManager

  readonly #homey: Homey

  readonly #zoneSettingsManager: ZoneSettingsManager

  public constructor(homey: Homey) {
    this.#homey = homey
    this.#deviceSettingsManager = new DeviceSettingsManager(homey)
    this.#zoneSettingsManager = new ZoneSettingsManager(
      homey,
      this.#deviceSettingsManager,
    )
    this.#errorLogManager = new ErrorLogManager(homey)
    this.#authManager = new AuthManager(homey, async () =>
      this.#loadPostLogin(),
    )
  }

  static async #fetchHomeySettings(homey: Homey): Promise<HomeySettings> {
    return new Promise((resolve) => {
      homey.get(async (error: Error | null, settings: HomeySettings) => {
        if (error) {
          await homey.alert(error.message)
          resolve({})
          return
        }
        resolve(settings)
      })
    })
  }

  static async #setDocumentLanguage(homey: Homey): Promise<void> {
    try {
      document.documentElement.lang = await homeyApiGet<string>(
        homey,
        '/language',
      )
    } catch {
      // Non-critical: page defaults to browser language
    }
  }

  public async init(): Promise<void> {
    const { contextKey, password, username } =
      await SettingsApp.#fetchHomeySettings(this.#homey)
    await SettingsApp.#setDocumentLanguage(this.#homey)
    await this.#deviceSettingsManager.fetchDeviceSettings()
    const driverSettings =
      await this.#deviceSettingsManager.fetchDriverSettings()
    this.#authManager.generateCredentials(driverSettings, {
      password,
      username,
    })
    this.#addEventListeners()
    await this.#load(contextKey)
    this.#homey.ready()
  }

  #addEventListeners(): void {
    this.#authManager.addEventListeners()
    this.#errorLogManager.addEventListeners()
    this.#zoneSettingsManager.addEventListeners()
    getButtonElement('auto_adjust').addEventListener('click', () => {
      this.#homey
        .openURL('https://homey.app/a/com.mecloud.extension')
        .catch(() => {
          //
        })
    })
  }

  #disableSettingButtons(): void {
    disableButton(this.#errorLogManager.seeElementId)
    this.#deviceSettingsManager.disableButtons('frost_protection')
    this.#deviceSettingsManager.disableButtons('holiday_mode')
    this.#deviceSettingsManager.disableButtons('settings_common')
  }

  async #fetchBuildings(): Promise<void> {
    const buildings = await homeyApiGet<BuildingZone[]>(
      this.#homey,
      '/buildings',
    ).catch(async (error: unknown) => {
      await this.#homey.alert(getErrorMessage(error))
      throw error
    })
    if (!buildings.length) {
      throw new NoDeviceError(this.#homey)
    }
    await this.#zoneSettingsManager.generateZones(buildings)
    await this.#errorLogManager.fetchErrorLog()
    await this.#zoneSettingsManager.fetchZoneSettings()
  }

  async #load(contextKey?: string | null): Promise<void> {
    if (contextKey !== undefined) {
      try {
        await this.#fetchBuildings()
        return
      } catch {
        // Session expired or no devices: fall through to login
      }
    }
    this.#authManager.needsAuthentication()
  }

  async #loadPostLogin(): Promise<void> {
    try {
      await this.#fetchBuildings()
    } catch (error) {
      if (error instanceof NoDeviceError) {
        this.#disableSettingButtons()
        await this.#homey.alert(error.message)
      }
    } finally {
      this.#authManager.needsAuthentication(false)
    }
  }
}

const onHomeyReady = async (homey: Homey): Promise<void> => {
  const app = new SettingsApp(homey)
  await app.init()
}

Object.assign(globalThis, { onHomeyReady })
