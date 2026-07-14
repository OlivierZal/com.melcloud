import type * as Classic from '@olivierzal/melcloud-api/classic'

import type { AtaGroupSettingWidgetSettings as HomeySettings } from '../../../types/widgets.mts'
import type { HomeBuildingZone, HomeDeviceZone } from '../../../types/zone.mts'
import {
  getButton,
  getDiv,
  getSelect,
  showInitError,
  translateAriaLabels,
} from '../../../public/dom.mts'
import {
  type Homey,
  fireAndForget,
  homeyApiGet,
  resolveHomey,
  surfaceError,
  trySetDocumentLanguage,
  withInitTimeout,
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

  // `ready()` always fires — an unbounded await here would hold Homey's
  // loading overlay open forever on a single hung or failed call.
  public async init(): Promise<void> {
    try {
      await withInitTimeout(this.#run())
    } catch (error) {
      showInitError(error)
    } finally {
      this.#homey.ready({ height: document.body.scrollHeight })
    }
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
    const [buildings, homeTargets] = await Promise.all([
      fetchList<Classic.BuildingZone>(
        this.#homey,
        `/classic/buildings?${new URLSearchParams({
          type: '0',
        } satisfies { type: `${Classic.DeviceType}` })}`,
      ),
      fetchList<HomeBuildingZone | HomeDeviceZone>(
        this.#homey,
        '/home/targets/ata',
      ),
    ])
    if (buildings.length > 0 || homeTargets.length > 0) {
      const { default_zone: defaultZone } = this.#homey.getSettings()
      this.#addEventListeners()
      this.#ataValueManager.createAtaFormControls()
      this.#ataValueManager.populateZoneOptions(buildings)
      this.#ataValueManager.populateZoneOptions(homeTargets)
      this.#ataValueManager.applyDefaultZone(defaultZone)
      await this.#fetchAndAnimate()
    }
  }

  async #run(): Promise<void> {
    translateAriaLabels((key) => this.#homey.__(key))
    await Promise.all([
      trySetDocumentLanguage(this.#homey),
      this.#ataValueManager.fetchCapabilities(),
    ])
    await this.#initTargets()
  }
}

// ── Entry point ──

const start = async (): Promise<void> => {
  const homey = await resolveHomey<Homey<HomeySettings>>()
  await new WidgetApp(homey).init()
}

// eslint-disable-next-line unicorn/prefer-top-level-await -- a top-level await would need an es2022 bundle target and could deadlock: the module would suspend on `homeyReady` while the SDK may wait for module evaluation before dispatching it
fireAndForget(start())
