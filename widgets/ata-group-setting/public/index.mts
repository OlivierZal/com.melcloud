import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { AtaGroupSettingWidgetSettings as HomeySettings } from '../../../types/widgets.mts'
import type { HomeDeviceZone } from '../../../types/zone.mts'
import {
  getButton,
  getDiv,
  getSelect,
  translateAriaLabels,
} from '../../../public/dom.mts'
import {
  type Homey,
  fireAndForget,
  homeyApiGet,
  setDocumentLanguage,
  surfaceError,
} from '../../../public/homey-api.mts'
import { AnimationController, AnimationDelay } from './animation.mts'
import { AtaValueManager } from './ata-values.mts'

// Selector sources are independent: a failing Classic fetch must not hide
// the Home devices (and vice versa) — e.g. an account on only one API.
const fetchList = async <T,>(homey: Homey, path: string): Promise<T[]> => {
  try {
    return await homeyApiGet<T[]>(homey, path)
  } catch (error) {
    surfaceError(error)
    return []
  }
}

// ── WidgetApp class ──

class WidgetApp {
  readonly #animationController: AnimationController

  readonly #ataValueManager: AtaValueManager

  #debounceTimeout: NodeJS.Timeout | null = null

  readonly #homey: Homey<HomeySettings>

  public constructor(homey: Homey<HomeySettings>) {
    this.#homey = homey
    const animation = getDiv('animation')
    const ataValues = getDiv('values_melcloud')
    const zone = getSelect('zones')
    this.#animationController = new AnimationController(homey, animation)
    this.#ataValueManager = new AtaValueManager(homey, ataValues, zone)
  }

  public async init(): Promise<void> {
    translateAriaLabels((key) => this.#homey.__(key))
    await Promise.all([
      setDocumentLanguage(this.#homey),
      this.#ataValueManager.fetchCapabilities(),
    ])
    await this.#initTargets()
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
      if (this.#debounceTimeout !== null) {
        clearTimeout(this.#debounceTimeout)
      }
      this.#debounceTimeout = setTimeout(() => {
        fireAndForget(this.#fetchAndAnimate())
      }, AnimationDelay.debounce)
    })
  }

  async #fetchAndAnimate(): Promise<void> {
    const values = await this.#ataValueManager.fetchValues()
    await this.#animationController.applyAnimation(values)
  }

  async #initTargets(): Promise<void> {
    const [buildings, homeDevices] = await Promise.all([
      fetchList<Classic.BuildingZone>(
        this.#homey,
        `/classic/buildings?${new URLSearchParams({
          type: '0',
        } satisfies { type: `${Classic.DeviceType}` })}`,
      ),
      fetchList<HomeDeviceZone>(this.#homey, '/home/devices/ata'),
    ])
    if (buildings.length > 0 || homeDevices.length > 0) {
      const { default_zone: defaultZone } = this.#homey.getSettings()
      this.#addEventListeners()
      this.#ataValueManager.createAtaFormControls()
      this.#ataValueManager.populateZoneOptions(buildings)
      this.#ataValueManager.populateZoneOptions(homeDevices)
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
