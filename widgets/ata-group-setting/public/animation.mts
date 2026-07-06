import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  CLASSIC_OPERATION_MODE_MIXED,
  ClassicFanSpeed,
  ClassicOperationMode,
  classicHeatModes,
} from '@olivierzal/melcloud-api/constants'

import type { GroupAtaStates } from '../../../types/classic-ata.mts'
import type { GetAtaOptions } from '../../../types/widgets.mts'
import { getSelect } from '../../../public/dom.mts'
import { type Homey, homeyApiGet } from '../../../public/homey-api.mts'
import { getZonePath } from '../../../public/zones.mts'
import {
  generateStyleNumber,
  generateStyleString,
  randomFraction,
} from './style-helpers.mts'

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

interface ResetParams {
  readonly isSomethingOn: boolean
  readonly mode: number
}

// ── Numeric constants ──

const FULL_CIRCLE = 2 * Math.PI

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

const LEAF_OSCILLATION_FACTOR = 5
// Smoke particle behaviour, expressed per nominal 60 fps frame. The
// old canvas loop stepped once per requestAnimationFrame, so its
// wall-clock speed varied with the display refresh rate; the WAAPI
// keyframes pin the trajectory to the 60 fps case.
const Smoke = {
  decayPerFrame: 0.002,
  framesPerSecond: 60,
  growthPerFrame: 1.002,
  iterations: 10,
  // Every live flame runs its own spawn chain, so dozens of flames can
  // otherwise pile up thousands of composited layers — the unbounded
  // cost that used to freeze the canvas version CPU-side.
  maxParticles: 500,
  msPerSecond: 1000,
  positionYMin: -50,
} as const

// The canvas stacked thousands of tiny 5 %-opacity ghosts and drew its
// density from the overlap; with the particle budget the same plume is
// rebuilt from fewer, larger, twice-as-opaque puffs (decay scales with
// opacity, so lifetimes are unchanged) — calibrated against canvas
// screenshots at widget scale.
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
const ANIMATION_KEYFRAME_COUNT = 101

// Safe widening: lets runtime `number` modes be probed without asserting
// them down to ClassicOperationMode.
const heatModeNumbers: ReadonlySet<number> = classicHeatModes

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

// Converts a CSS pixel length (e.g. `12.5px`) into its numeric value.
// Non-numeric values such as `auto` yield NaN. Unlike Number.parseFloat,
// an empty string coerces to 0 — no call site can produce one, since the
// inline positions are written before being read and getComputedStyle
// returns resolved values
const parsePixelValue = (value: string): number =>
  Number(value.replace('px', ''))

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

// Generates a parametric leaf animation: the leaf follows a curved path
// with a circular loop segment and sine-wave oscillation
const generateLeafAnimation = (
  leaf: HTMLDivElement,
  speed: number,
): Animation => {
  const loopStart = Math.floor(generateStyleNumber({ gap: 50, min: 10 }))
  const loopDuration = Math.floor(generateStyleNumber({ gap: 20, min: 20 }))
  const loopEnd = loopStart + loopDuration
  const loopRadius = generateStyleNumber({ gap: 40, min: 10 })
  const animation = leaf.animate(
    Array.from({ length: ANIMATION_KEYFRAME_COUNT }, (_element, index) => {
      const angle = ((index - loopStart) / loopDuration) * FULL_CIRCLE
      const indexLoopRadius =
        index >= loopStart && index < loopEnd ? loopRadius : 0
      const oscillate =
        indexLoopRadius > 0 ?
          ` translate(${String((indexLoopRadius / LEAF_OSCILLATION_FACTOR) * Math.sin(angle * LEAF_OSCILLATION_FACTOR))}px, 0px)`
        : ''
      const rotate = generateStyleString({ gap: 45, min: index }, 'deg')
      const translateX = `${String(
        index * LEAF_OSCILLATION_FACTOR + indexLoopRadius * Math.sin(angle),
      )}px`
      const translateY = `${String(
        -(index * 2 - indexLoopRadius * Math.cos(angle)),
      )}px`
      return {
        transform: `translate(${translateX}, ${translateY}) rotate(${rotate})${oscillate}`,
      }
    }),
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
  animation.onfinish = (): void => {
    leaf.remove()
  }
  return animation
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

const generateSunShineAnimation = (sun: HTMLDivElement): Animation =>
  sun.animate(
    [
      { filter: 'brightness(120%) blur(18px)', transform: 'rotate(0deg)' },
      { filter: 'brightness(120%) blur(18px)', transform: 'rotate(360deg)' },
    ],
    {
      duration: AnimationDelay.sunShine,
      easing: 'linear',
      iterations: Infinity,
    },
  )

const getPreviousElement = (name: string, index?: string): HTMLElement | null =>
  document.querySelector<HTMLElement>(`#${name}-${String(Number(index) - 1)}`)

const scheduleFlameRemoval = (): void => {
  const flames = [...document.querySelectorAll<HTMLElement>('.flame')]
  for (const flame of flames) {
    setTimeout(
      () => {
        flame.remove()
      },
      generateDelay(AnimationDelay.flame, ClassicFanSpeed.very_slow),
    )
  }
}

// ── AnimationController class ──

export class AnimationController {
  readonly #animation: HTMLDivElement

  readonly #animationMapping: Record<
    AnimatedElement,
    { readonly textContent: string; readonly getIndex: () => number }
  >

  readonly #animationRunners: Record<
    number,
    (speed: number) => Promise<void> | void
  > = {
    [CLASSIC_OPERATION_MODE_MIXED]: async (speed) =>
      this.#runMixedAnimation(speed),
    [ClassicOperationMode.auto]: (speed) => {
      this.#runFireAnimation(speed)
      this.#runSnowAnimation(speed)
    },
    [ClassicOperationMode.cool]: (speed) => {
      this.#runSnowAnimation(speed)
    },
    [ClassicOperationMode.dry]: (speed) => {
      this.#runSunAnimation(speed)
    },
    [ClassicOperationMode.fan]: (speed) => {
      this.#generateRecurring(
        (fanSpeed) => {
          this.#createLeaf(fanSpeed)
        },
        AnimationDelay.leaf,
        speed,
      )
    },
    [ClassicOperationMode.heat]: (speed) => {
      this.#runFireAnimation(speed)
    },
  }

  readonly #homey: Homey

  #liveSmokeCount = 0

  readonly #sunAnimation: Record<'enter' | 'exit' | 'shine', Animation | null> =
    {
      enter: null,
      exit: null,
      shine: null,
    }

  readonly #timeouts: NodeJS.Timeout[] = []

  public constructor(homey: Homey, animationElement: HTMLDivElement) {
    this.#homey = homey
    this.#animation = animationElement
    this.#animationMapping = createAnimationMapping()
  }

  public async applyAnimation(state: Classic.GroupState): Promise<void> {
    const { FanSpeed: speed, OperationMode: mode, Power: isOn } = state

    const isSomethingOn = isOn !== false
    const numberSpeed = Number(speed)
    const newSpeed =
      Number.isNaN(numberSpeed) || numberSpeed === 0 ?
        ClassicFanSpeed.moderate
      : numberSpeed
    const newMode = Number(mode ?? null)

    await this.#reset({ isSomethingOn, mode: newMode })

    if (isSomethingOn && this.#hasModeAnimation(newMode)) {
      await this.#animationRunners[newMode]?.(newSpeed)
    }
  }

  public async reset(resetParams?: ResetParams): Promise<void> {
    await this.#reset(resetParams)
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
        this.#generateFlameAnimation(flame, speed)
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

  #createSmoke(flame: HTMLDivElement, speed: number): void {
    if (!flame.isConnected) {
      return
    }

    // `#animation` is fixed at the viewport origin, so the flame's
    // viewport coordinates are also its coordinates in the container.
    const { left, top, width } = flame.getBoundingClientRect()
    const flameInsetBlockEnd = parsePixelValue(
      getComputedStyle(flame).insetBlockEnd,
    )
    for (let index = 0; index <= Smoke.iterations; index++) {
      this.#spawnSmokeParticle(
        left + width / 2,
        top - flameInsetBlockEnd,
        speed,
      )
    }
    setTimeout(
      () => {
        this.#createSmoke(flame, speed)
      },
      generateDelay(AnimationDelay.smoke, ClassicFanSpeed.very_slow),
    )
  }

  #createSmokeElement(size: number): HTMLDivElement {
    const particle = document.createElement('div')
    particle.classList.add('smoke')
    particle.style.setProperty('--size', `${String(2 * size)}px`)
    this.#animation.append(particle)
    this.#liveSmokeCount += 1
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

  #generateFlameAnimation(flame: HTMLDivElement, speed: number): Animation {
    const animation = flame.animate(
      Array.from({ length: ANIMATION_KEYFRAME_COUNT }, () => {
        const brightness = generateStyleString({ gap: 50, min: 100 }, '%')
        const rotate = generateStyleString({ gap: 12, min: -6 }, 'deg')
        const scaleX = generateStyleString({ gap: 0.4, min: 0.8 })
        const scaleY = generateStyleString({ gap: 0.4, min: 0.8 })
        return {
          filter: `brightness(${brightness})`,
          transform: `scale(${scaleX}, ${scaleY}) rotate(${rotate})`,
        }
      }),
      {
        duration: generateStyleNumber({
          divisor: speed,
          gap: 10,
          min: 20,
          multiplier: 1000,
        }),
        easing: 'ease-in-out',
      },
    )
    animation.onfinish = (): void => {
      flame.remove()
    }
    this.#createSmoke(flame, speed)
    return animation
  }

  #generateRecurring(
    create: (speed: number) => void,
    delay: number,
    speed: number,
  ): void {
    this.#timeouts.push(
      setTimeout(
        () => {
          create(speed)
          this.#generateRecurring(create, delay, speed)
        },
        generateDelay(delay, speed),
      ),
    )
  }

  #generateSunEnterAnimation(sun: HTMLDivElement): Animation {
    const duration = Number(
      this.#sunAnimation.exit?.currentTime ?? AnimationDelay.sunTransition,
    )
    this.#sunAnimation.exit?.pause()
    this.#sunAnimation.exit = null
    const { blockSize, inlineSize, insetBlockStart, insetInlineEnd } =
      getComputedStyle(sun)
    const animation = sun.animate(
      [
        {
          insetBlockStart: `${String(parsePixelValue(insetBlockStart))}px`,
          insetInlineEnd: `${String(parsePixelValue(insetInlineEnd))}px`,
        },
        {
          insetBlockStart: `${String(
            (window.innerHeight - parsePixelValue(blockSize)) / 2,
          )}px`,
          insetInlineEnd: `${String(
            (window.innerWidth - parsePixelValue(inlineSize)) / 2,
          )}px`,
        },
      ],
      { duration, easing: 'ease-in-out', fill: 'forwards' },
    )
    animation.onfinish = (): void => {
      this.#sunAnimation.enter = null
    }
    return animation
  }

  #generateSunExitAnimation(sun: HTMLDivElement): Animation {
    const duration = Number(
      this.#sunAnimation.enter?.currentTime ?? AnimationDelay.sunTransition,
    )
    this.#sunAnimation.enter?.pause()
    this.#sunAnimation.enter = null
    const { insetBlockStart, insetInlineEnd } = getComputedStyle(sun)
    const animation = sun.animate(
      [
        {
          insetBlockStart: `${String(parsePixelValue(insetBlockStart))}px`,
          insetInlineEnd: `${String(parsePixelValue(insetInlineEnd))}px`,
        },
        {
          insetBlockStart: `${String(-window.innerHeight)}px`,
          insetInlineEnd: `${String(-window.innerWidth)}px`,
        },
      ],
      { duration, easing: 'ease-in-out', fill: 'forwards' },
    )
    animation.onfinish = (): void => {
      sun.remove()
      this.#sunAnimation.enter = null
      this.#sunAnimation.exit = null
      this.#sunAnimation.shine = null
    }
    return animation
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

  #hasModeAnimation(mode: number): boolean {
    return Object.hasOwn(this.#animationRunners, mode)
  }

  async #reset(resetParams?: ResetParams): Promise<void> {
    for (const timeout of this.#timeouts) {
      clearTimeout(timeout)
    }
    this.#timeouts.length = 0
    await this.#resetFireAnimation(resetParams)
    await this.#resetSunAnimation(resetParams)
  }

  async #resetFireAnimation(resetParams?: ResetParams): Promise<void> {
    if (resetParams !== undefined) {
      const { isSomethingOn, mode } = resetParams
      const modes = await this.#getModes()
      if (
        isSomethingOn &&
        (heatModeNumbers.has(mode) ||
          (mode === CLASSIC_OPERATION_MODE_MIXED &&
            modes.some((currentMode) => heatModeNumbers.has(currentMode))))
      ) {
        return
      }
    }
    scheduleFlameRemoval()
  }

  async #resetSunAnimation(resetParams?: ResetParams): Promise<void> {
    const sun = document.querySelector('#sun-1')
    if (!(sun instanceof HTMLDivElement)) {
      return
    }
    if (resetParams?.isSomethingOn === true) {
      const modes = await this.#getModes()
      const isDryActive =
        resetParams.mode === ClassicOperationMode.dry ||
        (resetParams.mode === CLASSIC_OPERATION_MODE_MIXED &&
          modes.includes(ClassicOperationMode.dry))
      if (isDryActive) {
        return
      }
    }
    this.#sunAnimation.exit = this.#generateSunExitAnimation(sun)
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

  async #runMixedAnimation(speed: number): Promise<void> {
    const modes = new Set(await this.#getModes())
    if (
      modes.has(ClassicOperationMode.auto) ||
      modes.has(ClassicOperationMode.cool)
    ) {
      this.#runSnowAnimation(speed)
    }
    if (
      modes.has(ClassicOperationMode.auto) ||
      modes.has(ClassicOperationMode.heat)
    ) {
      this.#runFireAnimation(speed)
    }
    if (modes.has(ClassicOperationMode.dry)) {
      this.#runSunAnimation(speed)
    }
    if (modes.has(ClassicOperationMode.fan)) {
      this.#generateRecurring(
        (leafSpeed) => {
          this.#createLeaf(leafSpeed)
        },
        AnimationDelay.leaf,
        speed,
      )
    }
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
    this.#sunAnimation.shine ??= generateSunShineAnimation(sun)
    this.#sunAnimation.shine.playbackRate = speed
    this.#sunAnimation.enter ??= this.#generateSunEnterAnimation(sun)
  }

  // One compositor-driven animation per particle: the old canvas loop
  // moved linearly per frame, so translate/opacity interpolate the
  // same trajectory (at its nominal 60 fps pace) and the per-frame
  // size growth collapses to a scale keyframe. Only transform and
  // opacity animate — the soft edge lives in the element's gradient
  // texture — so no JavaScript and no filter pass run between spawns.
  #spawnSmokeParticle(
    positionX: number,
    positionY: number,
    speed: number,
  ): void {
    if (this.#liveSmokeCount >= Smoke.maxParticles) {
      return
    }
    const { opacity, size, speedX, speedY } = createSmokeParams()
    // Lifetime: whichever death the canvas loop hit first — opacity
    // fading to zero or the particle clearing the viewport top —
    // rounded up to whole frames like the discrete loop culled.
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
      this.#liveSmokeCount -= 1
    }
  }
}
