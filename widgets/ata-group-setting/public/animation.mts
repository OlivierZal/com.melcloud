import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  CLASSIC_OPERATION_MODE_MIXED,
  ClassicFanSpeed,
  ClassicOperationMode,
} from '@olivierzal/melcloud-api/constants'

import type { GroupAtaStates } from '../../../types/classic-ata.mts'
import type { GetAtaOptions } from '../../../types/widgets.mts'
import { getSelect } from '../../../public/dom.mts'
import {
  type Homey,
  fireAndForget,
  homeyApiGet,
  surfaceError,
} from '../../../public/homey-api.mts'
import { getZonePath } from '../../../public/zones.mts'
import {
  generateStyleNumber,
  generateStyleString,
  randomFraction,
} from './style-helpers.mts'

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

type SceneElement = 'fire' | 'leaf' | 'snow' | 'sun'

// ── Animation speed factors ──

const SPEED_FACTOR_MAX = 50
const SPEED_FACTOR_MIN = 1

// ── Animation timing & layout constants ──

// Delays between animation spawns (ms)
export const AnimationDelay = {
  debounce: 1000,
  flame: 2000,
  leaf: 1000,
  smoke: 500,
  snowflake: 400,
  sunShine: 5000,
  sunTransition: 5000,
} as const

// Minimum spacing between animated elements (px)
const AnimationGap = {
  flame: 20,
  leaf: 50,
  snowflake: 50,
} as const

// Distinct duration ranges keep the flicker periods non-commensurate,
// so the combined motion never visibly repeats (ms).
const FlickerDurationMin = {
  brightness: 500,
  rotate: 400,
  scale: 300,
} as const

// Baseline drift of a leaf per path unit, over `units` path units.
const LeafPath = {
  driftX: 5,
  driftY: -2,
  units: 100,
} as const

// Smoke particle behaviour, expressed per nominal 60 fps frame: each
// keyframe pair integrates the linear per-frame motion over the
// particle's whole lifetime.
const Smoke = {
  decayPerFrame: 0.002,
  framesPerSecond: 60,
  growthPerFrame: 1.002,
  iterations: 10,
  // Every live flame runs its own spawn chain, so dozens of concurrent
  // flames would otherwise pile up thousands of composited layers.
  maxParticles: 500,
  msPerSecond: 1000,
  positionYMin: -50,
} as const

// The plume reads as one continuous column because the puffs overlap:
// size and opacity are calibrated against the particle budget (decay
// scales with opacity, keeping lifetimes at 50-100 frames).
const createSmokeParams = (): {
  opacity: number
  size: number
  speedX: number
  speedY: number
} => ({
  opacity: generateStyleNumber({ gap: 0.1, min: 0.1 }),
  size: generateStyleNumber({ gap: 5, min: 5 }),
  speedX: generateStyleNumber({ gap: 0.2, min: -0.1 }),
  speedY: generateStyleNumber({ gap: 0.6, min: 0.2 }),
})

// Scene composition per direct operation mode; a mixed group resolves to
// the union over its members' modes. Keys are plain numbers so runtime
// modes can be probed without asserting them down to ClassicOperationMode.
const MODE_SCENES: Readonly<Partial<Record<number, readonly SceneElement[]>>> =
  {
    [ClassicOperationMode.auto]: ['fire', 'snow'],
    [ClassicOperationMode.cool]: ['snow'],
    [ClassicOperationMode.dry]: ['sun'],
    [ClassicOperationMode.fan]: ['leaf'],
    [ClassicOperationMode.heat]: ['fire'],
  }

const resolveMemberScene = (
  modes: readonly number[],
): ReadonlySet<SceneElement> =>
  new Set(modes.flatMap((mode) => MODE_SCENES[mode] ?? []))

// Queried lazily so module evaluation stays side-effect-free, and so each
// animation pass reads the current OS preference.
const prefersReducedMotion = (): boolean =>
  matchMedia('(prefers-reduced-motion: reduce)').matches

// Calculates a randomized delay with exponential speed scaling. Higher speed
// values produce shorter delays via exponential interpolation between
// factorMin and factorMax
const generateDelay = (delay: number, speed: number): number => {
  const speedFactor =
    SPEED_FACTOR_MIN *
    (SPEED_FACTOR_MAX / SPEED_FACTOR_MIN) **
      ((speed - ClassicFanSpeed.very_slow) /
        (ClassicFanSpeed.very_fast - ClassicFanSpeed.very_slow))
  return (
    (randomFraction() * delay) /
    (Number.isNaN(speedFactor) || speedFactor === 0 ? 1 : speedFactor)
  )
}

const getZoneValue = (): string => getZonePath(getSelect('zones').value)

const parseStateParams = (
  state: Classic.GroupState,
): { isSomethingOn: boolean; newMode: number; newSpeed: number } => {
  const { FanSpeed: speed, OperationMode: mode, Power: isOn } = state
  const numberSpeed = Number(speed)
  return {
    isSomethingOn: isOn !== false,
    newMode: Number(mode ?? null),
    newSpeed:
      Number.isNaN(numberSpeed) || numberSpeed === 0 ?
        ClassicFanSpeed.moderate
      : numberSpeed,
  }
}

// Converts a CSS pixel length (e.g. `12.5px`) into its numeric value.
// Non-numeric values such as `auto` yield NaN. Unlike Number.parseFloat,
// an empty string coerces to 0 — no call site can produce one, since the
// inline positions are written before being read and getComputedStyle
// returns resolved values
const parsePixelValue = (value: string): number =>
  Number(value.replace('px', ''))

// ── Orchestration helpers ──

const newAbortError = (): DOMException =>
  new DOMException('The animation was aborted', 'AbortError')

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError'

// Abortable delay: resolves after `ms`, rejects with an abort error as
// soon as `signal` aborts.
const sleep = async (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const done = AbortSignal.any([signal, AbortSignal.timeout(ms)])
    const settle = (): void => {
      if (signal.aborted) {
        reject(newAbortError())
        return
      }
      resolve()
    }
    // A signal that is already aborted never fires `abort`; settling
    // synchronously keeps the promise from hanging in that case.
    if (done.aborted) {
      settle()
      return
    }
    done.addEventListener('abort', settle, { once: true })
  })

const spawnUntilAborted = async (
  generateSpawnDelay: () => number,
  signal: AbortSignal,
  spawn: () => void,
): Promise<void> => {
  while (!signal.aborted) {
    // eslint-disable-next-line no-await-in-loop -- sequential by design: each spawn waits out its own randomized delay
    await sleep(generateSpawnDelay(), signal)
    // The abort can land between the sleep settling and this continuation
    // running (an earlier microtask may abort mid-drain); spawning then
    // would measure a detached element. `throwIfAborted` routes that exit
    // through the loop's normal abort path.
    signal.throwIfAborted()
    spawn()
  }
}

// Spawns elements on a randomized cadence until `signal` aborts; the
// abort rejection is the loop's normal exit and is swallowed.
const runSpawnLoop = async (
  generateSpawnDelay: () => number,
  signal: AbortSignal,
  spawn: () => void,
): Promise<void> => {
  try {
    await spawnUntilAborted(generateSpawnDelay, signal, spawn)
  } catch (error) {
    if (!isAbortError(error)) {
      throw error
    }
  }
}

const cancelAnimations = (element: HTMLElement): void => {
  for (const animation of element.getAnimations()) {
    animation.cancel()
  }
}

// ── Animation helpers ──

const createAnimationMapping = (): Record<
  AnimatedElement,
  { readonly textContent: string; readonly getIndex: () => number }
> => {
  let flameIndex = 0
  let leafIndex = 0
  let snowflakeIndex = 0
  return {
    flame: {
      textContent: '🔥',
      getIndex: () => ++flameIndex,
    },
    leaf: { textContent: '🍁', getIndex: () => ++leafIndex },
    snowflake: {
      textContent: '❄',
      getIndex: () => ++snowflakeIndex,
    },
    sun: { textContent: '☀', getIndex: () => 1 },
  }
}

// Negative delay starts each loop at a random phase so flames never sync.
const createFlickerTiming = (
  minDuration: number,
): KeyframeAnimationOptions => ({
  delay: -generateStyleNumber({ gap: 300, min: 0 }),
  direction: 'alternate',
  duration: generateStyleNumber({ gap: 200, min: minDuration }),
  easing: 'ease-in-out',
  iterations: Infinity,
})

const generateFlameScale = (): string =>
  `${generateStyleString({ gap: 0.4, min: 0.8 })} ${generateStyleString({ gap: 0.4, min: 0.8 })}`

// The individual scale/rotate properties and filter animate independently,
// so the three loops compose without clashing on transform.
const startFlameFlicker = (flame: HTMLDivElement): void => {
  flame.animate(
    [{ scale: generateFlameScale() }, { scale: generateFlameScale() }],
    createFlickerTiming(FlickerDurationMin.scale),
  )
  flame.animate(
    [{ rotate: '-6deg' }, { rotate: '6deg' }],
    createFlickerTiming(FlickerDurationMin.rotate),
  )
  flame.animate(
    [{ filter: 'brightness(100%)' }, { filter: 'brightness(150%)' }],
    createFlickerTiming(FlickerDurationMin.brightness),
  )
}

// Baseline up-right drift with a full circular loop-the-loop inserted at
// a random point. `path()` coordinates are relative to the leaf's own
// laid-out position, so its random block-start offset stays in charge
// of the vertical spread.
const generateLeafPath = (): string => {
  const loopRadius = generateStyleNumber({ gap: 40, min: 10 })
  const loopStart = Math.floor(generateStyleNumber({ gap: 50, min: 10 }))
  const diameter = 2 * loopRadius
  const preX = LeafPath.driftX * loopStart
  const preY = LeafPath.driftY * loopStart
  const postX = LeafPath.driftX * (LeafPath.units - loopStart)
  const postY = LeafPath.driftY * (LeafPath.units - loopStart)
  return [
    'M 0 0',
    `l ${String(preX)} ${String(preY)}`,
    `a ${String(loopRadius)} ${String(loopRadius)} 0 1 1 0 ${String(-diameter)}`,
    `a ${String(loopRadius)} ${String(loopRadius)} 0 1 1 0 ${String(diameter)}`,
    `l ${String(postX)} ${String(postY)}`,
  ].join(' ')
}

// The wobble lives on `transform`, which applies after the offset
// transform: it tilts the leaf in place without bending its trajectory.
const startLeafWobble = (leaf: HTMLDivElement): void => {
  const angle = generateStyleString({ gap: 10, min: 5 }, 'deg')
  leaf.animate(
    [{ transform: `rotate(-${angle})` }, { transform: `rotate(${angle})` }],
    {
      direction: 'alternate',
      duration: generateStyleNumber({ gap: 400, min: 600 }),
      easing: 'ease-in-out',
      iterations: Infinity,
    },
  )
}

const generateLeafAnimation = (leaf: HTMLDivElement, speed: number): void => {
  leaf.style.offsetPath = `path('${generateLeafPath()}')`
  startLeafWobble(leaf)
  const drift = leaf.animate(
    [{ offsetDistance: '0%' }, { offsetDistance: '100%' }],
    {
      duration: generateStyleNumber({
        divisor: speed,
        gap: 5,
        min: 3,
        multiplier: 1000,
      }),
      easing: 'linear',
      fill: 'forwards',
    },
  )
  drift.onfinish = (): void => {
    cancelAnimations(leaf)
    leaf.remove()
  }
}

const generateSnowflakeAnimation = (
  snowflake: HTMLDivElement,
  speed: number,
): Animation => {
  const animation = snowflake.animate(
    [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(100vb) rotate(360deg)' },
    ],
    {
      duration: generateStyleNumber({
        divisor: speed,
        gap: 1,
        min: 5,
        multiplier: 1000,
      }),
      easing: 'linear',
      fill: 'forwards',
    },
  )
  animation.onfinish = (): void => {
    snowflake.remove()
  }
  return animation
}

// The shine spins the individual `rotate` property, so it composes with
// the motion's `translate` instead of clashing on transform. The glow
// filter is static and lives in sun.css.
const generateSunShineAnimation = (sun: HTMLDivElement): Animation =>
  sun.animate([{ rotate: '0deg' }, { rotate: '360deg' }], {
    duration: AnimationDelay.sunShine,
    easing: 'linear',
    iterations: Infinity,
  })

const getPreviousElement = (name: string, index?: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`#${name}-${String(Number(index) - 1)}`)

// Every removal path ends a flame through its own controller, so
// everything bound to it — expiry, smoke chain — stops with it.
const flameControllers = new WeakMap<HTMLDivElement, AbortController>()

// Ends the flame after `delayMs` unless its controller aborts first.
// Lifetime is orchestrated here because the flicker animations are
// infinite and cannot signal completion themselves.
const expireFlame = async (
  flame: HTMLDivElement,
  controller: AbortController,
  delayMs: number,
): Promise<void> => {
  try {
    await sleep(delayMs, controller.signal)
  } catch (error) {
    if (isAbortError(error)) {
      return
    }
    throw error
  }
  cancelAnimations(flame)
  flame.remove()
  controller.abort()
}

// Graceful clear when the scene leaves fire: each flame lingers a random
// beat, then dies through its own controller. A flame whose natural
// expiry wins the race aborts first, turning this into a no-op.
const scheduleFlameRemoval = (): void => {
  for (const flame of document.querySelectorAll<HTMLDivElement>('.flame')) {
    const controller = flameControllers.get(flame)
    if (controller !== undefined) {
      fireAndForget(
        expireFlame(
          flame,
          controller,
          generateDelay(AnimationDelay.flame, ClassicFanSpeed.very_slow),
        ),
      )
    }
  }
}

// ── AnimationController class ──

export class AnimationController {
  readonly #animation: HTMLDivElement

  readonly #animationMapping: Record<
    AnimatedElement,
    { readonly textContent: string; readonly getIndex: () => number }
  >

  #controller = new AbortController()

  #generation = 0

  readonly #homey: Homey

  #isFireActive = false

  #lastState: Classic.GroupState | null = null

  #liveSmokeCount = 0

  #sunMotion: Animation | null = null

  #sunShine: Animation | null = null

  public constructor(homey: Homey, animationElement: HTMLDivElement) {
    this.#homey = homey
    this.#animation = animationElement
    this.#animationMapping = createAnimationMapping()
    document.addEventListener('visibilitychange', () => {
      this.#handleVisibilityChange()
    })
  }

  public async applyAnimation(state: Classic.GroupState): Promise<void> {
    this.#lastState = state

    // A state update landing while the page is hidden must not rebuild the
    // scene offscreen. The visibilitychange handler replays #lastState when
    // the page shows again.
    if (document.visibilityState === 'hidden') {
      return
    }

    const generation = ++this.#generation
    const scene = await this.#resolveScene(state)

    // Bail without touching the scene when the fetch failed (the running
    // scene stays live and the next update retries) or when a newer apply —
    // or a hide — superseded this pass while it awaited.
    if (scene === null || generation !== this.#generation) {
      return
    }

    this.#reset(scene)
    this.#startScene(scene, parseStateParams(state).newSpeed)
  }

  #createAnimatedElement(name: AnimatedElement): HTMLDivElement {
    const element = document.createElement('div')
    element.classList.add(name)
    if (Object.hasOwn(this.#animationMapping, name)) {
      const mapping = this.#animationMapping[name]
      element.textContent = mapping.textContent
      element.id = `${name}-${String(mapping.getIndex())}`
    }
    return element
  }

  #createFlame(speed: number): void {
    this.#createPositionedAnimatedElement({
      gap: AnimationGap.flame,
      name: 'flame',
      positionProperty: 'insetInlineStart',
      windowDimension: window.innerWidth,
      animate: (flame) => {
        this.#igniteFlame(flame, speed)
      },
      applyStyles: (flame) => {
        flame.style.setProperty(
          '--size',
          generateStyleString({ gap: 1, min: 3 }, 'rem'),
        )
      },
    })
  }

  #createLeaf(speed: number): void {
    this.#createPositionedAnimatedElement({
      gap: AnimationGap.leaf,
      name: 'leaf',
      positionProperty: 'insetBlockStart',
      windowDimension: window.innerHeight,
      animate: (leaf) => {
        generateLeafAnimation(leaf, speed)
      },
      applyStyles: (leaf) => {
        leaf.style.setProperty(
          '--size',
          generateStyleString({ gap: 1, min: 2 }, 'rem'),
        )
        leaf.style.setProperty(
          '--brightness',
          generateStyleString({ gap: 50, min: 100 }, '%'),
        )
      },
    })
  }

  #createPositionedAnimatedElement({
    animate,
    applyStyles,
    gap,
    name,
    positionProperty,
    windowDimension,
  }: {
    gap: number
    name: 'flame' | 'leaf' | 'snowflake'
    positionProperty: 'insetBlockStart' | 'insetInlineStart'
    windowDimension: number
    animate: (element: HTMLDivElement) => void
    applyStyles: (element: HTMLDivElement) => void
  }): void {
    const element = this.#createAnimatedElement(name)
    const [elementName, index] = element.id.split('-')
    if (elementName !== undefined) {
      const previousElement = getPreviousElement(elementName, index)
      const previousPosition =
        previousElement === null ?
          -gap * 2
        : parsePixelValue(previousElement.style[positionProperty])
      element.style[positionProperty] = generateStyleString(
        {
          gap,
          min:
            previousPosition > windowDimension ? -gap : previousPosition + gap,
        },
        'px',
      )
      applyStyles(element)
      this.#animation.append(element)
      animate(element)
    }
  }

  #createSmokeElement(size: number): HTMLDivElement {
    const particle = document.createElement('div')
    particle.classList.add('smoke')
    particle.style.setProperty('--size', `${String(2 * size)}px`)
    this.#animation.append(particle)
    ++this.#liveSmokeCount
    return particle
  }

  #createSnowflake(speed: number): void {
    this.#createPositionedAnimatedElement({
      gap: AnimationGap.snowflake,
      name: 'snowflake',
      positionProperty: 'insetInlineStart',
      windowDimension: window.innerWidth,
      animate: (snowflake) => {
        generateSnowflakeAnimation(snowflake, speed)
      },
      applyStyles: (snowflake) => {
        snowflake.style.setProperty(
          '--size',
          generateStyleString({ divisor: speed, gap: 1, min: 2 }, 'rem'),
        )
        snowflake.style.setProperty(
          '--brightness',
          generateStyleString({ gap: 20, min: 100 }, '%'),
        )
      },
    })
  }

  #generateRecurring(
    create: (speed: number) => void,
    delay: number,
    speed: number,
  ): void {
    fireAndForget(
      runSpawnLoop(
        () => generateDelay(delay, speed),
        this.#controller.signal,
        () => {
          create(speed)
        },
      ),
    )
  }

  #generateSunMotionAnimation(sun: HTMLDivElement): Animation {
    const motion = sun.animate(
      [
        { translate: 'calc(50% + 100vi) calc(-50% - 100vb)' },
        { translate: '50% -50%' },
      ],
      {
        duration: AnimationDelay.sunTransition,
        easing: 'ease-in-out',
        fill: 'both',
      },
    )
    // A finish while reversed means the sun is back offscreen.
    motion.onfinish = (): void => {
      if (motion.playbackRate >= 0) {
        return
      }
      cancelAnimations(sun)
      sun.remove()
      this.#sunMotion = null
      this.#sunShine = null
    }
    return motion
  }

  async #getModes(): Promise<number[]> {
    const detailedAtaStates = await homeyApiGet<GroupAtaStates>(
      this.#homey,
      `/classic/zones/${getZoneValue()}/ata/details?${new URLSearchParams({
        status: 'on',
      } satisfies Required<GetAtaOptions>)}`,
    )
    return detailedAtaStates.OperationMode
  }

  #getSunElement(): HTMLDivElement {
    const sun = document.querySelector('#sun-1')
    if (!(sun instanceof HTMLDivElement)) {
      const newSun = this.#createAnimatedElement('sun')
      this.#animation.append(newSun)
      return newSun
    }
    return sun
  }

  #handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      // Stop spawning offscreen and invalidate any apply pass still in
      // flight; already-running animations are harmless.
      ++this.#generation
      this.#controller.abort()
      return
    }
    if (this.#lastState !== null) {
      fireAndForget(this.applyAnimation(this.#lastState))
    }
  }

  #igniteFlame(flame: HTMLDivElement, speed: number): void {
    const flameController = new AbortController()
    flameControllers.set(flame, flameController)
    startFlameFlicker(flame)
    fireAndForget(
      expireFlame(
        flame,
        flameController,
        generateStyleNumber({
          divisor: speed,
          gap: 10,
          min: 20,
          multiplier: 1000,
        }),
      ),
    )
    // The smoke chain belongs to its flame alone: a reset that keeps the
    // flames alive keeps their smoke too, and every removal path ends the
    // flame through its controller.
    fireAndForget(
      runSpawnLoop(
        () => generateDelay(AnimationDelay.smoke, ClassicFanSpeed.very_slow),
        flameController.signal,
        () => {
          this.#spawnSmokeBatch(flame, speed)
        },
      ),
    )
  }

  // Everything spawned by the previous scene stops here — except flames
  // when the next scene still contains fire: they and their smoke chains
  // live on their own controllers.
  #reset(scene: ReadonlySet<SceneElement>): void {
    this.#controller.abort()
    this.#controller = new AbortController()
    this.#isFireActive = scene.has('fire')
    if (!this.#isFireActive) {
      scheduleFlameRemoval()
    }
    this.#resetSunAnimation(scene.has('sun'))
  }

  #resetSunAnimation(isSunActive: boolean): void {
    const motion = this.#sunMotion
    if (motion === null || isSunActive) {
      return
    }
    if (motion.playbackRate > 0) {
      motion.reverse()
    }
  }

  // Resolves which scene elements the new state activates — none when
  // everything is off or reduced motion is requested. The member-mode
  // fetch (mixed groups only) happens before any teardown, so a failure
  // resolves to null with the running scene untouched.
  async #resolveScene(
    state: Classic.GroupState,
  ): Promise<ReadonlySet<SceneElement> | null> {
    const { isSomethingOn, newMode } = parseStateParams(state)
    if (!isSomethingOn || prefersReducedMotion()) {
      return new Set()
    }
    if (newMode !== CLASSIC_OPERATION_MODE_MIXED) {
      return resolveMemberScene([newMode])
    }
    try {
      return resolveMemberScene(await this.#getModes())
    } catch (error) {
      // Surfaces in the widget dev tools; the next update retries.
      surfaceError(new Error('Scene resolution failed', { cause: error }))
      return null
    }
  }

  #runFireAnimation(speed: number): void {
    this.#generateRecurring(
      (flameSpeed) => {
        this.#createFlame(flameSpeed)
      },
      AnimationDelay.flame,
      speed,
    )
  }

  #runLeafAnimation(speed: number): void {
    this.#generateRecurring(
      (leafSpeed) => {
        this.#createLeaf(leafSpeed)
      },
      AnimationDelay.leaf,
      speed,
    )
  }

  #runSnowAnimation(speed: number): void {
    this.#generateRecurring(
      (snowSpeed) => {
        this.#createSnowflake(snowSpeed)
      },
      AnimationDelay.snowflake,
      speed,
    )
  }

  #runSunAnimation(speed: number): void {
    const sun = this.#getSunElement()
    this.#sunShine ??= generateSunShineAnimation(sun)
    this.#sunShine.playbackRate = speed
    this.#sunMotion ??= this.#generateSunMotionAnimation(sun)
    if (this.#sunMotion.playbackRate < 0) {
      this.#sunMotion.reverse()
    }
  }

  #spawnSmokeBatch(flame: HTMLDivElement, speed: number): void {
    // The chain deliberately outlives the scene signal (a heat-to-heat
    // reset keeps it), so standing down is its own job: instantly when
    // fire leaves the scene — lingering flames must not keep puffing —
    // and while the page is hidden. The loop keeps ticking and resumes
    // spawning when conditions return.
    if (!this.#isFireActive || document.visibilityState === 'hidden') {
      return
    }
    // `#animation` is fixed at the viewport origin, so the flame's
    // viewport coordinates are also its coordinates in the container.
    const { left, top, width } = flame.getBoundingClientRect()
    const flameInsetBlockEnd = parsePixelValue(
      getComputedStyle(flame).insetBlockEnd,
    )
    for (let index = 0; index <= Smoke.iterations; index++) {
      const isSpawned = this.#spawnSmokeParticle(
        left + width / 2,
        top - flameInsetBlockEnd,
        speed,
      )
      // Budget exhausted: skip the remaining no-op calls this tick.
      if (!isSpawned) {
        break
      }
    }
  }

  // One compositor-driven animation per particle: the motion is linear
  // per frame, so translate/opacity interpolate the whole trajectory
  // and the growth collapses to a scale keyframe. Only transform and
  // opacity animate — the soft edge lives in the element's gradient
  // texture — so no JavaScript and no filter pass run between spawns.
  #spawnSmokeParticle(
    positionX: number,
    positionY: number,
    speed: number,
  ): boolean {
    if (this.#liveSmokeCount >= Smoke.maxParticles) {
      return false
    }
    const { opacity, size, speedX, speedY } = createSmokeParams()
    // Lifetime: opacity fading to zero or the particle clearing the
    // viewport top, whichever comes first, in whole frames.
    const frames = Math.ceil(
      Math.max(
        1,
        Math.min(
          opacity / Smoke.decayPerFrame,
          (positionY - Smoke.positionYMin) / (speedY * speed),
        ),
      ),
    )
    const endScale = Smoke.growthPerFrame ** frames
    const particle = this.#createSmokeElement(size)
    const animation = particle.animate(
      [
        {
          opacity,
          transform: `translate(${String(positionX - size)}px, ${String(positionY - 2 * size)}px)`,
        },
        {
          opacity: Math.max(0, opacity - frames * Smoke.decayPerFrame),
          transform: `translate(${String(positionX - size + speedX * speed * frames)}px, ${String(
            positionY - 2 * size - speedY * speed * frames,
          )}px) scale(${String(endScale)})`,
        },
      ],
      {
        duration: (frames / Smoke.framesPerSecond) * Smoke.msPerSecond,
        easing: 'linear',
        fill: 'forwards',
      },
    )
    animation.onfinish = (): void => {
      particle.remove()
      --this.#liveSmokeCount
    }
    return true
  }

  // Runs synchronously right after #reset installs the fresh controller,
  // so every spawn loop is bound to it with no interleaving window.
  #startScene(scene: ReadonlySet<SceneElement>, speed: number): void {
    if (scene.has('fire')) {
      this.#runFireAnimation(speed)
    }
    if (scene.has('leaf')) {
      this.#runLeafAnimation(speed)
    }
    if (scene.has('snow')) {
      this.#runSnowAnimation(speed)
    }
    if (scene.has('sun')) {
      this.#runSunAnimation(speed)
    }
  }
}
