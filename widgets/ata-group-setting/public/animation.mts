import type { GroupState } from '@olivierzal/melcloud-api'

import type { GetAtaOptions, GroupAtaStates } from '../../../types/index.mts'
import {
  FanSpeed,
  heatModes,
  OPERATION_MODE_MIXED,
  OperationMode,
} from './constants.mts'
import { getSelect } from './dom.mts'
import { type Homey, homeyApiGet } from './homey-api.mts'
import { SmokeParticle, SmokeThreshold } from './smoke-particle.mts'
import { generateStyleNumber, generateStyleString } from './style-helpers.mts'
import { getZonePath } from './zones.mts'

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

export interface ResetParams {
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
const ANIMATION_KEYFRAME_COUNT = 101

/*
 * Calculates a randomized delay with exponential speed scaling. Higher speed
 * values produce shorter delays via exponential interpolation between
 * factorMin and factorMax
 */
const generateDelay = (delay: number, speed: number): number =>
  (Math.random() * delay) /
  (SPEED_FACTOR_MIN *
    (SPEED_FACTOR_MAX / SPEED_FACTOR_MIN) **
      ((speed - FanSpeed.very_slow) /
        (FanSpeed.very_fast - FanSpeed.very_slow)) || 1)

const getZoneValue = (): string => getZonePath(getSelect('zones').value)

// ── Animation helpers ──

const createAnimationMapping = (): Record<
  AnimatedElement,
  { readonly innerHTML: string; readonly getIndex: () => number }
> => {
  let flameIndex = 0
  let leafIndex = 0
  let snowflakeIndex = 0
  return {
    flame: {
      innerHTML: '🔥',
      getIndex: () => (flameIndex += 1),
    },
    leaf: { innerHTML: '🍁', getIndex: () => (leafIndex += 1) },
    snowflake: {
      innerHTML: '❄',
      getIndex: () => (snowflakeIndex += 1),
    },
    sun: { innerHTML: '☀', getIndex: () => 1 },
  }
}

/*
 * Generates a parametric leaf animation: the leaf follows a curved path
 * with a circular loop segment and sine-wave oscillation
 */
const generateLeafAnimation = (
  leaf: HTMLDivElement,
  speed: number,
): Animation => {
  const loopStart = Math.floor(generateStyleNumber({ gap: 50, min: 10 }))
  const loopDuration = Math.floor(generateStyleNumber({ gap: 20, min: 20 }))
  const loopEnd = loopStart + loopDuration
  const loopRadius = generateStyleNumber({ gap: 40, min: 10 })
  const animation = leaf.animate(
    [...Array.from({ length: ANIMATION_KEYFRAME_COUNT }).keys()].map(
      (index: number) => {
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
      },
    ),
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

// ── AnimationController class ──

export class AnimationController {
  readonly #animation: HTMLDivElement

  readonly #animationHandling: Record<
    number,
    (speed: number) => Promise<void> | void
  > = {
    [OPERATION_MODE_MIXED]: async (speed) => this.#handleMixedAnimation(speed),
    [OperationMode.auto]: (speed) => {
      this.#handleFireAnimation(speed)
      this.#handleSnowAnimation(speed)
    },
    [OperationMode.cool]: (speed) => {
      this.#handleSnowAnimation(speed)
    },
    [OperationMode.dry]: (speed) => {
      this.#handleSunAnimation(speed)
    },
    [OperationMode.fan]: (speed) => {
      this.#generateRecurring(
        (fanSpeed) => {
          this.#createLeaf(fanSpeed)
        },
        AnimationDelay.leaf,
        speed,
      )
    },
    [OperationMode.heat]: (speed) => {
      this.#handleFireAnimation(speed)
    },
  }

  readonly #animationMapping: Record<
    AnimatedElement,
    { readonly innerHTML: string; readonly getIndex: () => number }
  >

  readonly #canvas: HTMLCanvasElement

  readonly #canvasContext: CanvasRenderingContext2D | null

  readonly #homey: Homey

  #smokeAnimationFrameId: number | null = null

  #smokeParticles: SmokeParticle[] = []

  readonly #sunAnimation: Record<'enter' | 'exit' | 'shine', Animation | null> =
    {
      enter: null,
      exit: null,
      shine: null,
    }

  readonly #timeouts: NodeJS.Timeout[] = []

  public constructor(
    homey: Homey,
    animationElement: HTMLDivElement,
    canvas: HTMLCanvasElement,
  ) {
    this.#homey = homey
    this.#animation = animationElement
    this.#canvas = canvas
    this.#canvasContext = canvas.getContext('2d')
    this.#animationMapping = createAnimationMapping()
  }

  public async handleAnimation(
    state: GroupState,
    isAnimations: boolean,
  ): Promise<void> {
    if (isAnimations) {
      const { FanSpeed: speed, OperationMode: mode, Power: isOn } = state

      const isSomethingOn = isOn !== false
      const newSpeed = Number(speed) || FanSpeed.moderate
      const newMode = Number(mode ?? null)

      await this.#reset({ isSomethingOn, mode: newMode })

      if (isSomethingOn && this.#hasModeAnimation(newMode)) {
        await this.#animationHandling[newMode]?.(newSpeed)
      }
    }
  }

  public async reset(resetParams?: ResetParams): Promise<void> {
    await this.#reset(resetParams)
  }

  #createAnimatedElement(name: AnimatedElement): HTMLDivElement {
    const element = document.createElement('div')
    element.classList.add(name)
    if (name in this.#animationMapping) {
      const { [name]: mapping } = this.#animationMapping
      ;({ innerHTML: element.innerHTML } = mapping)
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
        flame.style.fontSize = generateStyleString({ gap: 1, min: 3 }, 'rem')
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
        leaf.style.fontSize = generateStyleString({ gap: 1, min: 2 }, 'rem')
        leaf.style.filter = `brightness(${generateStyleString(
          { gap: 50, min: 100 },
          '%',
        )})`
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
        previousElement ?
          Number.parseFloat(previousElement.style[positionProperty])
        : -gap * 2
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
    if (flame.isConnected && this.#canvasContext) {
      const { left, top, width } = flame.getBoundingClientRect()
      for (let index = 0; index <= SmokeThreshold.iterations; index += 1) {
        this.#smokeParticles.push(
          new SmokeParticle(
            this.#canvasContext,
            left + width / 2,
            top - Number.parseFloat(getComputedStyle(flame).insetBlockEnd),
          ),
        )
      }
      setTimeout(
        () => {
          this.#createSmoke(flame, speed)
        },
        generateDelay(AnimationDelay.smoke, FanSpeed.very_slow),
      )
    }
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
        snowflake.style.fontSize = generateStyleString(
          { divisor: speed, gap: 1, min: 2 },
          'rem',
        )
        snowflake.style.filter = `brightness(${generateStyleString(
          { gap: 20, min: 100 },
          '%',
        )})`
      },
    })
  }

  #generateFlameAnimation(flame: HTMLDivElement, speed: number): Animation {
    const animation = flame.animate(
      [...Array.from({ length: ANIMATION_KEYFRAME_COUNT }).keys()].map(() => {
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

  #generateSmoke(speed: number): void {
    if (this.#canvasContext) {
      ;({ innerHeight: this.#canvas.height, innerWidth: this.#canvas.width } =
        globalThis)
      this.#canvasContext.clearRect(
        0,
        0,
        this.#canvas.width,
        this.#canvas.height,
      )
      this.#smokeParticles = this.#smokeParticles.filter((particle) => {
        particle.update(speed)
        particle.draw()
        return (
          particle.size > SmokeThreshold.sizeMin &&
          particle.opacity > SmokeThreshold.opacityMin &&
          particle.positionY > SmokeThreshold.positionYMin
        )
      })
      this.#smokeAnimationFrameId = requestAnimationFrame(() => {
        this.#generateSmoke(speed)
      })
    }
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
          insetBlockStart: `${String(Number.parseFloat(insetBlockStart))}px`,
          insetInlineEnd: `${String(Number.parseFloat(insetInlineEnd))}px`,
        },
        {
          insetBlockStart: `${String(
            (window.innerHeight - Number.parseFloat(blockSize)) / 2,
          )}px`,
          insetInlineEnd: `${String(
            (window.innerWidth - Number.parseFloat(inlineSize)) / 2,
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
          insetBlockStart: `${String(Number.parseFloat(insetBlockStart))}px`,
          insetInlineEnd: `${String(Number.parseFloat(insetInlineEnd))}px`,
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
    const detailedAtaValues = await homeyApiGet<GroupAtaStates>(
      this.#homey,
      `/zones/${getZoneValue()}/ata?${new URLSearchParams({
        mode: 'detailed',
        status: 'on',
      } satisfies Required<GetAtaOptions>)}`,
    )
    return detailedAtaValues.OperationMode
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

  #handleFireAnimation(speed: number): void {
    this.#generateRecurring(
      (flameSpeed) => {
        this.#createFlame(flameSpeed)
      },
      AnimationDelay.flame,
      speed,
    )
    this.#generateSmoke(speed)
  }

  async #handleMixedAnimation(speed: number): Promise<void> {
    const modes = new Set(await this.#getModes())
    if (modes.has(OperationMode.auto) || modes.has(OperationMode.cool)) {
      this.#handleSnowAnimation(speed)
    }
    if (modes.has(OperationMode.auto) || modes.has(OperationMode.heat)) {
      this.#handleFireAnimation(speed)
    }
    if (modes.has(OperationMode.dry)) {
      this.#handleSunAnimation(speed)
    }
    if (modes.has(OperationMode.fan)) {
      this.#generateRecurring(
        (leafSpeed) => {
          this.#createLeaf(leafSpeed)
        },
        AnimationDelay.leaf,
        speed,
      )
    }
  }

  #handleSnowAnimation(speed: number): void {
    this.#generateRecurring(
      (snowSpeed) => {
        this.#createSnowflake(snowSpeed)
      },
      AnimationDelay.snowflake,
      speed,
    )
  }

  #handleSunAnimation(speed: number): void {
    const sun = this.#getSunElement()
    this.#sunAnimation.shine ??= generateSunShineAnimation(sun)
    this.#sunAnimation.shine.playbackRate = speed
    this.#sunAnimation.enter ??= this.#generateSunEnterAnimation(sun)
  }

  #hasModeAnimation(mode: number): boolean {
    return mode in this.#animationHandling
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
    if (resetParams) {
      const { isSomethingOn, mode } = resetParams
      const modes = await this.#getModes()
      if (
        isSomethingOn &&
        (heatModes.has(mode) ||
          (mode === OPERATION_MODE_MIXED &&
            modes.some((currentMode) => heatModes.has(currentMode))))
      ) {
        if (this.#smokeAnimationFrameId !== null) {
          cancelAnimationFrame(this.#smokeAnimationFrameId)
          this.#smokeAnimationFrameId = null
        }
        return
      }
    }
    // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
    for (const flame of Array.from(
      document.querySelectorAll<HTMLElement>('.flame'),
    )) {
      setTimeout(
        () => {
          flame.remove()
        },
        generateDelay(AnimationDelay.flame, FanSpeed.very_slow),
      )
    }
  }

  async #resetSunAnimation(resetParams?: ResetParams): Promise<void> {
    const sun = document.querySelector('#sun-1')
    if (!(sun instanceof HTMLDivElement)) {
      return
    }
    if (resetParams?.isSomethingOn === true) {
      const modes = await this.#getModes()
      const isDryActive =
        resetParams.mode === OperationMode.dry ||
        (resetParams.mode === OPERATION_MODE_MIXED &&
          modes.includes(OperationMode.dry))
      if (isDryActive) {
        return
      }
    }
    this.#sunAnimation.exit = this.#generateSunExitAnimation(sun)
  }
}
