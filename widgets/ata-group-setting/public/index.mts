import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { AtaGroupSettingWidgetSettings as HomeySettings } from '../../../types/widgets.mts'
import { AnimationController, AnimationDelay } from './animation.mts'
import { AtaValueManager } from './ata-values.mts'
import { getButton, getCanvas, getDiv, getSelect } from './dom.mts'
import {
  type Homey,
  fireAndForget,
  homeyApiGet,
  setDocumentLanguage,
} from './homey-api.mts'

// ── WidgetApp class ──

class WidgetApp {
  readonly #animationController: AnimationController

  readonly #ataValueManager: AtaValueManager

  #debounceTimeout: NodeJS.Timeout | null = null

  readonly #homey: Homey<HomeySettings>

  #isAnimations = false

  public constructor(homey: Homey<HomeySettings>) {
    this.#homey = homey
    const animation = getDiv('animation')
    const canvas = getCanvas('smoke_canvas')
    const ataValues = getDiv('values_melcloud')
    const zone = getSelect('zones')
    this.#animationController = new AnimationController(
      homey,
      animation,
      canvas,
    )
    this.#ataValueManager = new AtaValueManager(homey, ataValues, zone)
  }

  public async init(): Promise<void> {
    await Promise.all([
      setDocumentLanguage(this.#homey),
      this.#ataValueManager.fetchCapabilities(),
    ])
    await this.#initBuildings()
    this.#homey.ready({ height: document.body.scrollHeight })
  }

  #addEventListeners(): void {
    const zone = getSelect('zones')
    const refreshAtaValues = getButton('refresh_values_melcloud')
    const updateAtaValues = getButton('apply_values_melcloud')
    zone.addEventListener('change', () => {
      fireAndForget(this.#fetchAndAnimate())
    })
    refreshAtaValues.addEventListener('click', () => {
      this.#homey.hapticFeedback()
      this.#ataValueManager.displayValues()
    })
    updateAtaValues.addEventListener('click', () => {
      this.#homey.hapticFeedback()
      fireAndForget(this.#ataValueManager.setValues())
    })
    this.#homey.on('deviceupdate', () => {
      if (this.#debounceTimeout) {
        clearTimeout(this.#debounceTimeout)
      }
      this.#debounceTimeout = setTimeout(() => {
        fireAndForget(this.#fetchAndAnimate())
      }, AnimationDelay.debounce)
    })
  }

  async #fetchAndAnimate(): Promise<void> {
    const values = await this.#ataValueManager.fetchValues()
    await this.#animationController.applyAnimation(values, this.#isAnimations)
  }

  async #initBuildings(): Promise<void> {
    const buildings = await homeyApiGet<Classic.BuildingZone[]>(
      this.#homey,
      `/classic/buildings?${new URLSearchParams({
        type: '0',
      } satisfies { type: `${Classic.DeviceType}` })}`,
    )
    if (buildings.length > 0) {
      const { animations: isAnimations, default_zone: defaultZone } =
        this.#homey.getSettings()
      this.#isAnimations = isAnimations
      this.#addEventListeners()
      this.#ataValueManager.createAtaFormControls()
      await this.#ataValueManager.populateZoneOptions(buildings)
      this.#ataValueManager.applyDefaultZone(defaultZone)
      await this.#fetchAndAnimate()
    }
  }
}

// ── Entry point ──

const onHomeyReady = async (homey: Homey<HomeySettings>): Promise<void> => {
  const app = new WidgetApp(homey)
  await app.init()
}

Object.assign(globalThis, { onHomeyReady })
