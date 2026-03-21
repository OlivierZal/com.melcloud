import type { DeviceType } from '@olivierzal/melcloud-api'

import type { BuildingZone } from '../../../types/index.mts'

import type { Homey } from './types.mts'

import { AnimationController, AnimationDelay } from './animation.mts'
import { AtaValueManager } from './ata-values.mts'
import {
  getButtonElement,
  getCanvasElement,
  getDivElement,
  getSelectElement,
} from './dom.mts'

const homeyApi = async <T,>(homey: Homey, path: string): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  (await homey.api('GET', path)) as T

const setDocumentLanguage = async (homey: Homey): Promise<void> => {
  document.documentElement.lang = String(await homey.api('GET', '/language'))
}

// ── WidgetApp class ──

class WidgetApp {
  readonly #animationController: AnimationController

  readonly #ataValueManager: AtaValueManager

  readonly #homey: Homey

  #debounceTimeout: NodeJS.Timeout | null = null

  #isAnimations = false

  public constructor(homey: Homey) {
    this.#homey = homey
    const animationElement = getDivElement('animation')
    const canvas = getCanvasElement('smoke_canvas')
    const ataValuesElement = getDivElement('values_melcloud')
    const zoneElement = getSelectElement('zones')
    this.#animationController = new AnimationController(
      homey,
      animationElement,
      canvas,
    )
    this.#ataValueManager = new AtaValueManager(
      homey,
      ataValuesElement,
      zoneElement,
    )
  }

  public async init(): Promise<void> {
    await setDocumentLanguage(this.#homey)
    await this.#ataValueManager.fetchCapabilities()
    await this.#initBuildings()
    this.#homey.ready({ height: document.body.scrollHeight })
  }

  #addEventListeners(): void {
    const zoneElement = getSelectElement('zones')
    const refreshAtaValuesElement = getButtonElement('refresh_values_melcloud')
    const updateAtaValuesElement = getButtonElement('apply_values_melcloud')
    zoneElement.addEventListener('change', () => {
      this.#fetchAndAnimate().catch(() => {
        //
      })
    })
    refreshAtaValuesElement.addEventListener('click', () => {
      this.#homey.hapticFeedback()
      this.#ataValueManager.refreshValues()
    })
    updateAtaValuesElement.addEventListener('click', () => {
      this.#homey.hapticFeedback()
      this.#ataValueManager.setValues().catch(() => {
        //
      })
    })
    this.#homey.on('deviceupdate', () => {
      if (this.#debounceTimeout) {
        clearTimeout(this.#debounceTimeout)
      }
      this.#debounceTimeout = setTimeout(() => {
        this.#fetchAndAnimate().catch(() => {
          //
        })
      }, AnimationDelay.debounce)
    })
  }

  async #fetchAndAnimate(): Promise<void> {
    const values = await this.#ataValueManager.fetchValues()
    await this.#animationController.handleAnimation(values, this.#isAnimations)
  }

  async #initBuildings(): Promise<void> {
    const buildings = await homeyApi<BuildingZone[]>(
      this.#homey,
      `/buildings?${new URLSearchParams({
        type: '0',
      } satisfies { type: `${DeviceType}` })}`,
    )
    if (buildings.length) {
      const { animations: isAnimations, default_zone: defaultZone } =
        this.#homey.getSettings()
      this.#isAnimations = isAnimations
      this.#addEventListeners()
      this.#ataValueManager.generateAtaValues()
      await this.#ataValueManager.generateZones(buildings)
      this.#ataValueManager.handleDefaultZone(defaultZone)
      await this.#fetchAndAnimate()
    }
  }
}

// ── Entry point ──

const onHomeyReady = async (homey: Homey): Promise<void> => {
  const app = new WidgetApp(homey)
  await app.init()
}

Object.assign(globalThis, { onHomeyReady })
