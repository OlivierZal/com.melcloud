import type { GroupState, OperationMode } from '@olivierzal/melcloud-api'

import type {
  GetAtaOptions,
  GroupAtaStates,
} from '../../../types/index.mts'

import type { Homey } from './types.mts'

import { getSelectElement } from './dom.mts'

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

export interface ResetParams {
  readonly isSomethingOn: boolean
  readonly mode: number
}

// ── Numeric constants ──

const DEFAULT_DIVISOR_ONE = 1
const DEFAULT_MULTIPLIER_ONE = 1
const FACTOR_TWO = 2
const FACTOR_FIVE = 5
const FACTOR_TEN = 10
const INCREMENT_ONE = 1
const START_ANGLE = 0
const FULL_CIRCLE = FACTOR_TWO * Math.PI

// ── Speed constants ──

// Fan speed constants and animation speed factors
export const Speed = {
  factorMax: 50,
  factorMin: 1,
  moderate: 3,
  veryFast: 5,
  verySlow: 1,
} as const

// ── Operation modes ──

const MODE_MIXED = 0
const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2
const MODE_FAN = 7
const MODE_HEAT = 1
export const coolModes = new Set([MODE_AUTO, MODE_COOL, MODE_DRY])
const heatModes = new Set([MODE_AUTO, MODE_HEAT])
type Mode =
  | typeof MODE_AUTO
  | typeof MODE_COOL
  | typeof MODE_DRY
  | typeof MODE_FAN
  | typeof MODE_HEAT
  | typeof MODE_MIXED

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

// Thresholds for smoke particle lifecycle
const SmokeThreshold = {
  iterations: 10,
  opacityMin: 0,
  positionYMin: -50,
  sizeMin: 0.1,
} as const

const DEFAULT_RECT_X = 0
const DEFAULT_RECT_Y = 0
const LEAF_NO_LOOP_RADIUS = 0

const ANIMATION_KEYFRAME_COUNT = 101

// ── Style helpers ──

const generateStyleNumber = ({
  divisor,
  gap,
  min,
  multiplier,
}: {
  gap: number
  min: number
  divisor?: number
  multiplier?: number
}): number =>
  ((Math.random() * gap + min) * (multiplier ?? DEFAULT_MULTIPLIER_ONE)) /
  ((divisor ?? DEFAULT_DIVISOR_ONE) || DEFAULT_DIVISOR_ONE)

const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`

/*
 * Calculates a randomized delay with exponential speed scaling. Higher speed
 * values produce shorter delays via exponential interpolation between
 * factorMin and factorMax
 */
const generateDelay = (delay: number, speed: number): number =>
  (Math.random() * delay) /
  (Speed.factorMin *
    (Speed.factorMax / Speed.factorMin) **
      ((speed - Speed.verySlow) / (Speed.veryFast - Speed.verySlow)) ||
    DEFAULT_DIVISOR_ONE)

// ── API helper ──

const homeyApi = async <T,>(homey: Homey, path: string): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  (await homey.api('GET', path)) as T

const getZonePath = (): string =>
  getSelectElement('zones').value.replace('_', '/')

// ── SmokeParticle class ──

class SmokeParticle {
  public opacity = generateStyleNumber({ gap: 0.05, min: 0.05 })

  public positionY: number

  public size = generateStyleNumber({ gap: 2, min: 2 })

  readonly #context: CanvasRenderingContext2D

  readonly #speedX: number

  readonly #speedY: number

  #positionX: number

  public constructor(
    context: CanvasRenderingContext2D,
    positionX: number,
    positionY: number,
  ) {
    this.#context = context
    this.#positionX = positionX
    this.#speedX = generateStyleNumber({ gap: 0.2, min: -0.1 })
    this.#speedY = generateStyleNumber({ gap: 0.6, min: 0.2 })
    this.positionY = positionY
  }

  public draw(): void {
    this.#context.beginPath()
    this.#context.arc(
      this.#positionX,
      this.positionY,
      this.size,
      START_ANGLE,
      FULL_CIRCLE,
    )
    this.#context.filter = `blur(${String(this.size / FACTOR_TEN)}px)`
    this.#context.fillStyle = `rgba(200, 200, 200, ${String(this.opacity)})`
    this.#context.fill()
    this.#context.filter = 'none'
  }

  public update(speed: number): void {
    this.opacity -= 0.001
    this.#positionX += this.#speedX * speed
    this.positionY -= this.#speedY * speed
    this.size *= 1.002
  }
}

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
      getIndex: () => (flameIndex += INCREMENT_ONE),
    },
    leaf: { innerHTML: '🍁', getIndex: () => (leafIndex += INCREMENT_ONE) },
    snowflake: {
      innerHTML: '❄',
      getIndex: () => (snowflakeIndex += INCREMENT_ONE),
    },
    sun: { innerHTML: '☀', getIndex: () => INCREMENT_ONE },
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
          index >= loopStart && index < loopEnd ?
            loopRadius
          : LEAF_NO_LOOP_RADIUS
        const oscillate =
          indexLoopRadius > LEAF_NO_LOOP_RADIUS ?
            ` translate(${String((indexLoopRadius / FACTOR_FIVE) * Math.sin(angle * FACTOR_FIVE))}px, 0px)`
          : ''
        const rotate = generateStyleString({ gap: 45, min: index }, 'deg')
        const translateX = `${String(
          index * FACTOR_FIVE + indexLoopRadius * Math.sin(angle),
        )}px`
        const translateY = `${String(
          -(index * FACTOR_TWO - indexLoopRadius * Math.cos(angle)),
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
  document.querySelector<HTMLElement>(
    `#${name}-${String(Number(index) - INCREMENT_ONE)}`,
  )

// ── AnimationController class ──

export class AnimationController {
  readonly #animationElement: HTMLDivElement

  readonly #animationHandling: Record<
    Mode,
    (speed: number) => Promise<void> | void
  > = {
    [MODE_AUTO]: (speed) => {
      this.#handleFireAnimation(speed)
      this.#handleSnowAnimation(speed)
    },
    [MODE_COOL]: (speed) => {
      this.#handleSnowAnimation(speed)
    },
    [MODE_DRY]: (speed) => {
      this.#handleSunAnimation(speed)
    },
    [MODE_FAN]: (speed) => {
      this.#generateRecurring(
        (fanSpeed) => {
          this.#createLeaf(fanSpeed)
        },
        AnimationDelay.leaf,
        speed,
      )
    },
    [MODE_HEAT]: (speed) => {
      this.#handleFireAnimation(speed)
    },
    [MODE_MIXED]: async (speed) => this.#handleMixedAnimation(speed),
  }

  readonly #animationMapping: Record<
    AnimatedElement,
    { readonly innerHTML: string; readonly getIndex: () => number }
  >

  readonly #canvas: HTMLCanvasElement

  readonly #canvasContext: CanvasRenderingContext2D | null

  readonly #homey: Homey

  readonly #sunAnimation: Record<'enter' | 'exit' | 'shine', Animation | null> =
    {
      enter: null,
      exit: null,
      shine: null,
    }

  readonly #timeouts: NodeJS.Timeout[] = []

  #smokeAnimationFrameId: number | null = null

  #smokeParticles: SmokeParticle[] = []

  public constructor(
    homey: Homey,
    animationElement: HTMLDivElement,
    canvas: HTMLCanvasElement,
  ) {
    this.#homey = homey
    this.#animationElement = animationElement
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
      const newSpeed = Number(speed) || Speed.moderate
      const newMode = Number(mode ?? null)

      await this.#reset({ isSomethingOn, mode: newMode })

      if (isSomethingOn && this.#hasModeAnimation(newMode)) {
        await this.#animationHandling[newMode](newSpeed)
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
        : -gap * FACTOR_TWO
      element.style[positionProperty] = generateStyleString(
        {
          gap,
          min:
            previousPosition > windowDimension ? -gap : previousPosition + gap,
        },
        'px',
      )
      applyStyles(element)
      this.#animationElement.append(element)
      animate(element)
    }
  }

  #createSmoke(flame: HTMLDivElement, speed: number): void {
    if (flame.isConnected && this.#canvasContext) {
      const { left, top, width } = flame.getBoundingClientRect()
      let index = 0
      while (index <= SmokeThreshold.iterations) {
        this.#smokeParticles.push(
          new SmokeParticle(
            this.#canvasContext,
            left + width / FACTOR_TWO,
            top - Number.parseFloat(getComputedStyle(flame).insetBlockEnd),
          ),
        )
        index += INCREMENT_ONE
      }
      setTimeout(
        () => {
          this.#createSmoke(flame, speed)
        },
        generateDelay(AnimationDelay.smoke, Speed.verySlow),
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
        DEFAULT_RECT_X,
        DEFAULT_RECT_Y,
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
            (window.innerHeight - Number.parseFloat(blockSize)) / FACTOR_TWO,
          )}px`,
          insetInlineEnd: `${String(
            (window.innerWidth - Number.parseFloat(inlineSize)) / FACTOR_TWO,
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

  async #getModes(): Promise<OperationMode[]> {
    const detailedAtaValues = await homeyApi<GroupAtaStates>(
      this.#homey,
      `/values/ata/${getZonePath()}?${new URLSearchParams({
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
      this.#animationElement.append(newSun)
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
    if (modes.has(MODE_AUTO) || modes.has(MODE_COOL)) {
      this.#handleSnowAnimation(speed)
    }
    if (modes.has(MODE_AUTO) || modes.has(MODE_HEAT)) {
      this.#handleFireAnimation(speed)
    }
    if (modes.has(MODE_DRY)) {
      this.#handleSunAnimation(speed)
    }
    if (modes.has(MODE_FAN)) {
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

  #hasModeAnimation(mode: number): mode is Mode {
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
          (mode === MODE_MIXED &&
            modes.some((currentMode) => heatModes.has(currentMode))))
      ) {
        if (this.#smokeAnimationFrameId !== null) {
          cancelAnimationFrame(this.#smokeAnimationFrameId)
          this.#smokeAnimationFrameId = null
        }
        return
      }
    }
    // eslint-disable-next-line unicorn/prefer-spread
    for (const flame of Array.from(
      document.querySelectorAll<HTMLElement>('.flame'),
    )) {
      setTimeout(
        () => {
          flame.remove()
        },
        generateDelay(AnimationDelay.flame, Speed.verySlow),
      )
    }
  }

  async #resetSunAnimation(resetParams?: ResetParams): Promise<void> {
    const sun = document.querySelector('#sun-1')
    const modes = await this.#getModes()
    if (
      sun &&
      sun instanceof HTMLDivElement &&
      (!resetParams ||
        !resetParams.isSomethingOn ||
        (resetParams.mode !== MODE_DRY &&
          (resetParams.mode !== MODE_MIXED ||
            modes.every((currentMode: number) => currentMode !== MODE_DRY))))
    ) {
      this.#sunAnimation.exit = this.#generateSunExitAnimation(sun)
    }
  }
}
