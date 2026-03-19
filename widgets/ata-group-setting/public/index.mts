/* eslint-disable max-classes-per-file */
import type {
  DeviceType,
  GroupState,
  OperationMode,
} from '@olivierzal/melcloud-api'
import type HomeyWidget from 'homey/lib/HomeyWidget'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  GroupAtaStates,
  HomeyWidgetSettingsAtaGroupSetting as HomeySettings,
  Settings,
  ValueOf,
  Zone,
} from '../../../types/index.mts'

declare interface Homey extends HomeyWidget {
  readonly getSettings: () => HomeySettings
}

const homeyApi = async <T,>(homey: Homey, path: string): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  (await homey.api('GET', path)) as T

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

interface ResetParams {
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

// ── Temperature constants ──

const MIN_SET_TEMPERATURE = 10
const MAX_SET_TEMPERATURE = 31
const MIN_SET_TEMPERATURE_COOLING = 16

// ── Operation modes ──

const MODE_MIXED = 0
const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2
const MODE_FAN = 7
const MODE_HEAT = 1
const coolModes = new Set([MODE_AUTO, MODE_COOL, MODE_DRY])
const heatModes = new Set([MODE_AUTO, MODE_HEAT])
type Mode =
  | typeof MODE_AUTO
  | typeof MODE_COOL
  | typeof MODE_DRY
  | typeof MODE_FAN
  | typeof MODE_HEAT
  | typeof MODE_MIXED

// ── Speed constants ──

const SPEED_VERY_SLOW = 1
const SPEED_MODERATE = 3
const SPEED_VERY_FAST = 5
const SPEED_FACTOR_MIN = 1
const SPEED_FACTOR_MAX = 50

// ── Animation timing & layout constants ──

const DEBOUNCE_DELAY = 1000
const FLAME_DELAY = 2000
const LEAF_DELAY = 1000
const SMOKE_DELAY = 500
const SNOWFLAKE_DELAY = 400
const SUN_ENTER_AND_EXIT_DURATION = 5000
const SUN_SHINE_DURATION = 5000

const DEFAULT_RECT_X = 0
const DEFAULT_RECT_Y = 0
const FLAME_GAP = 20
const LEAF_GAP = 50
const LEAF_NO_LOOP_RADIUS = 0
const SMOKE_ITERATIONS = 10
const SMOKE_PARTICLE_SIZE_MIN = 0.1
const SMOKE_PARTICLE_OPACITY_MIN = 0
const SMOKE_PARTICLE_POSITION_Y_MIN = -50
const SNOWFLAKE_GAP = 50

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

const generateDelay = (delay: number, speed: number): number =>
  (Math.random() * delay) /
  (SPEED_FACTOR_MIN *
    (SPEED_FACTOR_MAX / SPEED_FACTOR_MIN) **
      ((speed - SPEED_VERY_SLOW) / (SPEED_VERY_FAST - SPEED_VERY_SLOW)) ||
    DEFAULT_DIVISOR_ONE)

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

// ── DOM helpers ──

const booleanStrings: string[] = ['false', 'true'] satisfies `${boolean}`[]

const elementTypes = new Set(['boolean', 'enum'])

const getElement = <T extends HTMLElement>(
  id: string,
  elementConstructor: new () => T,
  elementType: string,
): T => {
  const element = document.querySelector(`#${id}`)
  if (!(element instanceof elementConstructor)) {
    throw new TypeError(`Element with id \`${id}\` is not a ${elementType}`)
  }
  return element
}

const getButtonElement = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

const getCanvasElement = (id: string): HTMLCanvasElement =>
  getElement(id, HTMLCanvasElement, 'canvas')

const getDivElement = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

const getSelectElement = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

// ── DOM creation helpers ──

const createLabelElement = (
  valueElement: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const labelElement = document.createElement('label')
  labelElement.classList.add(
    'label',
    'text-default',
    'text-color',
    'font-normal',
  )
  ;({ id: labelElement.htmlFor } = valueElement)
  labelElement.textContent = text
  labelElement.append(valueElement)
  return labelElement
}

const createValueElement = (
  parentElement: HTMLElement,
  {
    title,
    valueElement,
  }: { title: string; valueElement: HTMLValueElement | null },
): void => {
  if (valueElement) {
    parentElement.append(createLabelElement(valueElement, title))
  }
}

const handleNumericInputElement = (
  inputElement: HTMLInputElement,
  { max, min }: { max?: number; min?: number },
): void => {
  if (inputElement.type === 'number') {
    inputElement.setAttribute('inputmode', 'numeric')
    if (min !== undefined) {
      inputElement.min = String(min)
    }
    if (max !== undefined) {
      inputElement.max = String(max)
    }
  }
}

const createInputElement = ({
  id,
  max,
  min,
  placeholder,
  type,
  value,
}: {
  id: string
  type: string
  max?: number
  min?: number
  placeholder?: string
  value?: string
}): HTMLInputElement => {
  const inputElement = document.createElement('input')
  inputElement.classList.add(
    'input',
    'input-ghost',
    'text-default',
    'text-light',
    'font-normal',
  )
  inputElement.id = id
  inputElement.value = value ?? ''
  inputElement.type = type
  handleNumericInputElement(inputElement, { max, min })
  if (placeholder !== undefined) {
    inputElement.placeholder = placeholder
  }
  return inputElement
}

const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!selectElement.querySelector(`option[value="${id}"]`)) {
    selectElement.append(new Option(label, id))
  }
}

const createSelectElement = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add(
    'select',
    'select-ghost',
    'text-default',
    'text-light',
    'font-normal',
  )
  selectElement.id = id
  for (const option of [
    { id: '', label: '' },
    ...(values ??
      booleanStrings.map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ]) {
    createOptionElement(selectElement, option)
  }
  return selectElement
}

// ── Zone helpers ──

const getZoneId = (id: number, model: string): string =>
  `${model}_${String(id)}`
const getZoneName = (name: string, level: number): string =>
  `${'···'.repeat(level)} ${name}`

// ── Language ──

const setDocumentLanguage = async (homey: Homey): Promise<void> => {
  document.documentElement.lang = String(await homey.api('GET', '/language'))
}

// ── Value processing ──

const handleIntMin = (id: string, min: string): string =>
  (
    id === 'SetTemperature' &&
    coolModes.has(Number(getSelectElement('OperationMode').value))
  ) ?
    String(MIN_SET_TEMPERATURE_COOLING)
  : min

const int = ({ id, max, min, value }: HTMLInputElement): number => {
  const numberValue = Number(value)
  const newMin = Number(handleIntMin(id, min))
  const newMax = Number(max)
  if (!Number.isFinite(numberValue)) {
    throw new TypeError('Invalid number')
  }
  return Math.min(Math.max(numberValue, newMin), newMax)
}

const processValue = (element: HTMLValueElement): ValueOf<Settings> => {
  if (element.value) {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return int(element)
    }
    if (booleanStrings.includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}

const getSubzones = (zone: Zone): Zone[] => [
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

// ── AnimationController class ──

class AnimationController {
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
        LEAF_DELAY,
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
    this.#animationMapping = this.#createAnimationMapping()
  }

  public async handleAnimation(
    state: GroupState,
    isAnimations: boolean,
  ): Promise<void> {
    if (isAnimations) {
      const { FanSpeed: speed, OperationMode: mode, Power: isOn } = state
      const isSomethingOn = isOn !== false
      const newSpeed = Number(speed) || SPEED_MODERATE
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #createAnimationMapping(): Record<
    AnimatedElement,
    { readonly innerHTML: string; readonly getIndex: () => number }
  > {
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

  #createFlame(speed: number): void {
    this.#createPositionedAnimatedElement({
      gap: FLAME_GAP,
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
      gap: LEAF_GAP,
      name: 'leaf',
      positionProperty: 'insetBlockStart',
      windowDimension: window.innerHeight,
      animate: (leaf) => {
        this.#generateLeafAnimation(leaf, speed)
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
      const previousElement = this.#getPreviousElement(elementName, index)
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
      while (index <= SMOKE_ITERATIONS) {
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
        generateDelay(SMOKE_DELAY, SPEED_VERY_SLOW),
      )
    }
  }

  #createSnowflake(speed: number): void {
    this.#createPositionedAnimatedElement({
      gap: SNOWFLAKE_GAP,
      name: 'snowflake',
      positionProperty: 'insetInlineStart',
      windowDimension: window.innerWidth,
      animate: (snowflake) => {
        this.#generateSnowflakeAnimation(snowflake, speed)
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #generateLeafAnimation(leaf: HTMLDivElement, speed: number): Animation {
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
          particle.size > SMOKE_PARTICLE_SIZE_MIN &&
          particle.opacity > SMOKE_PARTICLE_OPACITY_MIN &&
          particle.positionY > SMOKE_PARTICLE_POSITION_Y_MIN
        )
      })
      this.#smokeAnimationFrameId = requestAnimationFrame(() => {
        this.#generateSmoke(speed)
      })
    }
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #generateSnowflakeAnimation(
    snowflake: HTMLDivElement,
    speed: number,
  ): Animation {
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

  #generateSunEnterAnimation(sun: HTMLDivElement): Animation {
    const duration = Number(
      this.#sunAnimation.exit?.currentTime ?? SUN_ENTER_AND_EXIT_DURATION,
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
      this.#sunAnimation.enter?.currentTime ?? SUN_ENTER_AND_EXIT_DURATION,
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #generateSunShineAnimation(sun: HTMLDivElement): Animation {
    return sun.animate(
      [
        { filter: 'brightness(120%) blur(18px)', transform: 'rotate(0deg)' },
        { filter: 'brightness(120%) blur(18px)', transform: 'rotate(360deg)' },
      ],
      { duration: SUN_SHINE_DURATION, easing: 'linear', iterations: Infinity },
    )
  }

  async #getModes(): Promise<OperationMode[]> {
    const detailedAtaValues = await homeyApi<GroupAtaStates>(
      this.#homey,
      `/values/ata/${this.#getZonePath()}?${new URLSearchParams({
        mode: 'detailed',
        status: 'on',
      } satisfies Required<GetAtaOptions>)}`,
    )
    return detailedAtaValues.OperationMode
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #getPreviousElement(name: string, index?: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(
      `#${name}-${String(Number(index) - INCREMENT_ONE)}`,
    )
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

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  #getZonePath(): string {
    return getSelectElement('zones').value.replace('_', '/')
  }

  #handleFireAnimation(speed: number): void {
    this.#generateRecurring(
      (flameSpeed) => {
        this.#createFlame(flameSpeed)
      },
      FLAME_DELAY,
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
        LEAF_DELAY,
        speed,
      )
    }
  }

  #handleSnowAnimation(speed: number): void {
    this.#generateRecurring(
      (snowSpeed) => {
        this.#createSnowflake(snowSpeed)
      },
      SNOWFLAKE_DELAY,
      speed,
    )
  }

  #handleSunAnimation(speed: number): void {
    const sun = this.#getSunElement()
    this.#sunAnimation.shine ??= this.#generateSunShineAnimation(sun)
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
        generateDelay(FLAME_DELAY, SPEED_VERY_SLOW),
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

// ── AtaValueManager class ──

class AtaValueManager {
  readonly #ataValuesElement: HTMLDivElement

  readonly #homey: Homey

  readonly #zoneElement: HTMLSelectElement

  readonly #zoneMapping: Partial<Record<string, Partial<GroupState>>> = {}

  #ataCapabilities: [keyof GroupState, DriverCapabilitiesOptions][] = []

  #defaultAtaValues: Partial<Record<keyof GroupState, null>> = {}

  public constructor(
    homey: Homey,
    ataValuesElement: HTMLDivElement,
    zoneElement: HTMLSelectElement,
  ) {
    this.#homey = homey
    this.#ataValuesElement = ataValuesElement
    this.#zoneElement = zoneElement
  }

  public async fetchCapabilities(): Promise<void> {
    this.#ataCapabilities = await homeyApi<
      [keyof GroupState, DriverCapabilitiesOptions][]
    >(this.#homey, '/capabilities/ata')
    this.#defaultAtaValues = Object.fromEntries(
      this.#ataCapabilities.map(([ataKey]) => [ataKey, null]),
    )
  }

  public async fetchValues(): Promise<GroupState> {
    const values = await homeyApi<GroupState>(
      this.#homey,
      `/values/ata/${this.#getZonePath()}`,
    )
    this.#updateZoneMapping({ ...this.#defaultAtaValues, ...values })
    this.#refreshAtaValues()
    return values
  }

  public generateAtaValues(): void {
    for (const [id, { title, type, values }] of this.#ataCapabilities) {
      createValueElement(this.#ataValuesElement, {
        title,
        valueElement: this.#generateAtaValue({ id, type, values }),
      })
    }
  }

  public async generateZones(zones: Zone[] = []): Promise<void> {
    if (zones.length) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOptionElement(this.#zoneElement, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        // eslint-disable-next-line no-await-in-loop
        await this.generateZones(getSubzones(zone))
      }
    }
  }

  public handleDefaultZone(defaultZone: Zone | null): void {
    if (defaultZone) {
      const { id, model } = defaultZone
      const value = getZoneId(id, model)
      if (document.querySelector(`#zones option[value="${value}"]`)) {
        this.#zoneElement.value = value
      }
    }
  }

  public refreshValues(): void {
    this.#refreshAtaValues()
  }

  public async setValues(): Promise<void> {
    try {
      const body = this.#buildAtaValuesBody()
      if (Object.keys(body).length) {
        await this.#homey.api(
          'PUT',
          `/values/ata/${this.#getZonePath()}`,
          body satisfies GroupState,
        )
      }
    } catch {}
  }

  #buildAtaValuesBody(): GroupState {
    return Object.fromEntries(
      // eslint-disable-next-line unicorn/prefer-spread
      Array.from(
        this.#ataValuesElement.querySelectorAll<HTMLValueElement>(
          'input, select',
        ),
      )
        .filter(
          ({ id, value }) =>
            this.#isGroupAtaState(id) &&
            ![
              '',
              this.#zoneMapping[this.#zoneElement.value]?.[id]?.toString(),
            ].includes(value),
        )
        .map((element) => [element.id, processValue(element)]),
    )
  }

  #generateAtaValue({
    id,
    type,
    values,
  }: {
    id: string
    type: string
    values?: readonly { id: string; label: string }[]
  }): HTMLValueElement | null {
    if (elementTypes.has(type)) {
      return createSelectElement(this.#homey, id, values)
    }
    if (type === 'number') {
      return createInputElement({
        id,
        max: id === 'SetTemperature' ? MAX_SET_TEMPERATURE : undefined,
        min: id === 'SetTemperature' ? MIN_SET_TEMPERATURE : undefined,
        type,
      })
    }
    return null
  }

  #getZonePath(): string {
    return this.#zoneElement.value.replace('_', '/')
  }

  #isGroupAtaState(value: string): value is keyof GroupState {
    return value in this.#defaultAtaValues
  }

  #refreshAtaValues(): void {
    for (const [ataKey] of this.#ataCapabilities) {
      this.#updateAtaValue(ataKey)
    }
  }

  #updateAtaValue(id: keyof GroupState): void {
    const ataValueElement = document.querySelector(`#${id}`)
    if (
      ataValueElement &&
      (ataValueElement instanceof HTMLInputElement ||
        ataValueElement instanceof HTMLSelectElement)
    ) {
      ataValueElement.value =
        this.#zoneMapping[this.#zoneElement.value]?.[id]?.toString() ?? ''
    }
  }

  #updateZoneMapping(data: Partial<GroupState>): void {
    const { value } = this.#zoneElement
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
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
      }, DEBOUNCE_DELAY)
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

// @ts-expect-error: read by another script in `./index.html`
// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  const app = new WidgetApp(homey)
  await app.init()
}
