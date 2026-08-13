import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  getButton,
  getDiv,
  getFieldset,
  getSelect,
} from '@olivierzal/homey-kit/dom'
import {
  fireAndForget,
  runWebview,
  surfaceError,
  trySetDocumentLanguage,
} from '@olivierzal/homey-kit/webview'

import type { AtaGroupSettingWidgetSettings as HomeySettings } from '../../../types/widgets.mts'
import type { HomeBuildingZone, HomeDeviceZone } from '../../../types/zone.mts'
import {
  hideInitError,
  showInitError,
  translateAriaLabels,
} from '../../../public/dom.mts'
import { watchWidgetFreshness } from '../../../public/webview-freshness-boot.mts'
import { type Homey, homeyApiGet } from '../../../public/widget.mts'
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

  #isReady = false

  public constructor(homey: Homey<HomeySettings>) {
    this.#homey = homey
    const animation = getDiv('animation')
    const ataValues = getFieldset('values_melcloud')
    const zone = getSelect('zones')
    this.#animationController = new AnimationController(homey, animation)
    this.#ataValueManager = new AtaValueManager(homey, ataValues, zone)
  }

  // `ready()` always fires — an unbounded await here would hold Homey's
  // loading overlay open forever on a single hung or failed call.
  public async init(): Promise<void> {
    // A stale cached page refetches itself once (never-cached address)
    // instead of booting: skip the init — the document is about to be
    // replaced.
    if (await watchWidgetFreshness(this.#homey, 'ata-group-setting')) {
      return
    }
    await runWebview(this.#homey, this.#run(), {
      onError: showInitError,
      height: () => document.body.scrollHeight,
    })
    this.#isReady = true
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
        fireAndForget(this.#refreshKeepingEdits())
      }, AnimationDelay.debounce)
    })
  }

  // Zone switch and initial load take the full sync ("show me the zone
  // as it stands"); the real-time stream must not clobber an edit in
  // progress, so it goes through the edit-keeping sync instead.
  async #fetchAndAnimate(): Promise<void> {
    const values = await this.#ataValueManager.fetchValues()
    await this.#animationController.applyAnimation(values)
  }

  async #initTargets(): Promise<void> {
    const [buildings, homeTargets] = await Promise.all([
      fetchList<Classic.BuildingZone>(
        this.#homey,
        `/classic/buildings?${new URLSearchParams({ type: '0' } satisfies {
          type: `${Classic.DeviceType}`
        })}`,
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

  async #refreshKeepingEdits(): Promise<void> {
    const values = await this.#ataValueManager.fetchValuesKeepingEdits()
    await this.#animationController.applyAnimation(values)
  }

  async #run(): Promise<void> {
    translateAriaLabels((key) => this.#homey.__(key))
    await Promise.all([
      trySetDocumentLanguage(async () =>
        homeyApiGet<string>(this.#homey, '/language'),
      ),
      this.#ataValueManager.fetchCapabilities(),
    ])
    await this.#initTargets()
    // A load that outlived its timeout recovers here: drop the message
    // and resize to the recovered content (`ready` heights are one-shot).
    hideInitError()
    if (this.#isReady) {
      await this.#homey.setHeight(document.body.scrollHeight)
    }
  }
}

// ── Entry point ──

/**
 * Page entry point, invoked by the HTML's canonical `onHomeyReady` once
 * the SDK has dispatched (see the inline script in the page head).
 * @param homey - The Homey instance handed to `onHomeyReady`.
 */
export const start = async (homey: Homey<HomeySettings>): Promise<void> => {
  const app = new WidgetApp(homey)
  await app.init()
}
