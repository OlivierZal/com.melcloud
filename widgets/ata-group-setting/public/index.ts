import type {
  GroupAtaState,
  OperationMode,
  ZoneSettings,
} from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeyWidget'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  GetAtaOptions,
  Settings,
  ValueOf,
  Zone,
} from '../../../types'

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

type AnimatedElement = 'flame' | 'leaf' | 'snowflake' | 'sun'

const DEFAULT_DIVISOR = 1
const DEFAULT_MULTIPLIER = 1

const START_ANGLE = 0
const END_ANGLE_MULTIPLIER = 2
const SIZE_DIVISOR_FOR_SMOKE_BLUR = 10

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
  ((Math.random() * gap + min) * (multiplier ?? DEFAULT_MULTIPLIER)) /
  ((divisor ?? DEFAULT_DIVISOR) || DEFAULT_DIVISOR)

class SmokeParticle {
  public opacity = generateStyleNumber({ gap: 0.05, min: 0.05 })

  public posY: number

  public size = generateStyleNumber({ gap: 2, min: 2 })

  readonly #ctx: CanvasRenderingContext2D

  readonly #speedX: number

  readonly #speedY: number

  #posX: number

  public constructor(
    ctx: CanvasRenderingContext2D,
    posX: number,
    posY: number,
  ) {
    this.#ctx = ctx
    this.#posX = posX
    this.#speedX = generateStyleNumber({ gap: 0.2, min: -0.1 })
    this.#speedY = generateStyleNumber({ gap: 0.6, min: 0.2 })
    this.posY = posY
  }

  public draw(): void {
    this.#ctx.beginPath()
    this.#ctx.arc(
      this.#posX,
      this.posY,
      this.size,
      START_ANGLE,
      Math.PI * END_ANGLE_MULTIPLIER,
    )
    this.#ctx.filter = `blur(${String(this.size / SIZE_DIVISOR_FOR_SMOKE_BLUR)}px)`
    this.#ctx.fillStyle = `rgba(200, 200, 200, ${String(this.opacity)})`
    this.#ctx.fill()
    this.#ctx.filter = 'none'
  }

  public update(speed: number): void {
    this.opacity -= 0.001
    this.#posX += this.#speedX * speed
    this.posY -= this.#speedY * speed
    this.size *= 1.002
  }
}

const FACTOR_TWO = 2
const FACTOR_FIVE = 5
const INCREMENT = 1

const FIRST_LEVEL = 0
const SECOND_LEVEL = 1

const minMapping = { SetTemperature: 10 } as const
const maxMapping = { SetTemperature: 31 } as const
const MIN_SET_TEMPERATURE_COOLING = 16

const MODE_MIXED = 0
const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2
const MODE_FAN = 7
const MODE_HEAT = 1
const HEAT_MODES = [MODE_AUTO, MODE_HEAT]

const SPEED_VERY_SLOW = 1
const SPEED_MODERATE = 3
const SPEED_VERY_FAST = 5
const SPEED_FACTOR_MIN = 1
const SPEED_FACTOR_MAX = 50

const DEBOUNCE_DELAY = 1000
const FLAME_DELAY = 2000
const LEAF_DELAY = 1000
const SMOKE_DELAY = 500
const SNOWFLAKE_DELAY = 400

const DEFAULT_RECT_X = 0
const DEFAULT_RECT_Y = 0
const FLAME_INTERVAL = 20
const LEAF_INTERVAL = 50
const LEAF_NO_LOOP_RADIUS = 0
const SMOKE_PARTICLE_SIZE_MIN = 0.1
const SMOKE_PARTICLE_OPACITY_MIN = 0
const SMOKE_PARTICLE_POS_Y_MIN = -50
const SNOWFLAKE_INTERVAL = 50
const SUN_BOTTOM_POS_Y_FACTOR = 1.25
const SUN_SHINE_DURATION = 5000

const zoneMapping: Partial<
  Record<string, Partial<GroupAtaState & ZoneSettings>>
> = {}

const refreshAtaValues = document.getElementById(
  'refresh_values_melcloud',
) as HTMLButtonElement
const updateAtaValues = document.getElementById(
  'apply_values_melcloud',
) as HTMLButtonElement

const canvas = document.getElementById('smoke_canvas') as HTMLCanvasElement
const canvasCtx = canvas.getContext('2d')

const animationElement = document.getElementById('animation') as HTMLDivElement
const ataValuesElement = document.getElementById(
  'values_melcloud',
) as HTMLDivElement
const hasZoneAtaDevicesElement = document.getElementById(
  'has_zone_ata_devices',
) as HTMLDivElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement

const animationTimeouts: NodeJS.Timeout[] = []
const sunAnimation: Record<'enter' | 'exit' | 'shine', Animation | null> = {
  enter: null,
  exit: null,
  shine: null,
}

let debounceTimeout: NodeJS.Timeout | null = null

let ataCapabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][] = []
let defaultAtaValues: Partial<Record<keyof GroupAtaState, null>> = {}

let smokeAnimationFrameId: number | null = null
let smokeParticles: SmokeParticle[] = []

const createAnimationMapping = (): Record<
  AnimatedElement,
  { readonly getIndex: () => number; readonly innerHTML: string }
> => {
  let flameIndex = 0
  let leafIndex = 0
  let snowflakeIndex = 0
  return {
    flame: { getIndex: () => (flameIndex += INCREMENT), innerHTML: '🔥' },
    leaf: { getIndex: () => (leafIndex += INCREMENT), innerHTML: '🍁' },
    snowflake: {
      getIndex: () => (snowflakeIndex += INCREMENT),
      innerHTML: '❄',
    },
    sun: { getIndex: () => INCREMENT, innerHTML: '☀' },
  }
}
const animationMapping = createAnimationMapping()

const getZonePath = (): string => zoneElement.value.replace('_', '/')

const generateStyleString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateStyleNumber(params))}${unit}`

const generateDelay = (delay: number, speed: number): number =>
  (Math.random() * delay) /
  (SPEED_FACTOR_MIN *
    (SPEED_FACTOR_MAX / SPEED_FACTOR_MIN) **
      ((speed - SPEED_VERY_SLOW) / (SPEED_VERY_FAST - SPEED_VERY_SLOW)) ||
    DEFAULT_DIVISOR)

const hide = (element: HTMLDivElement, value = true): void => {
  element.classList.toggle('hidden', value)
}

const unhide = (element: HTMLDivElement, value = true): void => {
  hide(element, !value)
}

const setDocumentLanguage = async (homey: Homey): Promise<void> => {
  try {
    document.documentElement.lang = (await homey.api(
      'GET',
      '/language',
    )) as string
  } catch (_error) {}
}

const createLabelElement = (
  valueElement: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const labelElement = document.createElement('label')
  labelElement.classList.add('label')
  ;({ id: labelElement.htmlFor } = valueElement)
  labelElement.innerText = text
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
  inputElement.classList.add('input')
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
  if (
    !selectElement.querySelector<HTMLOptionElement>(`option[value="${id}"]`)
  ) {
    selectElement.append(new Option(label, id))
  }
}

const createSelectElement = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('select')
  selectElement.id = id
  ;[
    { id: '', label: '' },
    ...(values ??
      ['false', 'true'].map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ].forEach((option) => {
    createOptionElement(selectElement, option)
  })
  return selectElement
}

const createAnimatedElement = (name: AnimatedElement): HTMLDivElement => {
  const element = document.createElement('div')
  element.classList.add(name)
  if (name in animationMapping) {
    const { [name]: mapping } = animationMapping
    ;({ innerHTML: element.innerHTML } = mapping)
    element.id = `${name}-${String(mapping.getIndex())}`
  }
  return element
}

const handleIntMin = (id: string, min: string): string =>
  (
    id === 'SetTemperature' &&
    [MODE_AUTO, MODE_COOL, MODE_DRY].includes(
      Number(
        (document.getElementById('OperationMode') as HTMLSelectElement).value,
      ),
    )
  ) ?
    String(MIN_SET_TEMPERATURE_COOLING)
  : min

const int = ({ id, max, min, value }: HTMLInputElement): number => {
  const numberValue = Number(value)
  const newMin = Number(handleIntMin(id, min))
  const newMax = Number(max)
  if (!Number.isFinite(numberValue)) {
    throw new Error()
  }
  if (numberValue < newMin) {
    return newMin
  }
  if (numberValue > newMax) {
    return newMax
  }
  return numberValue
}

const processValue = (element: HTMLValueElement): ValueOf<Settings> => {
  if (element.value) {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return int(element)
    }
    if (['false', 'true'].includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}

const buildAtaValuesBody = (): GroupAtaState => {
  const body = Object.fromEntries(
    Array.from(
      ataValuesElement.querySelectorAll<HTMLValueElement>('input, select'),
    )
      .filter(
        ({ id, value }) =>
          value !== '' &&
          value !==
            zoneMapping[zoneElement.value]?.[
              id as keyof GroupAtaState
            ]?.toString(),
      )
      .map((element) => [element.id, processValue(element)]),
  )
  return body
}

const updateZoneMapping = (data: Partial<GroupAtaState>): void => {
  const { value } = zoneElement
  zoneMapping[value] = { ...zoneMapping[value], ...data }
}

const updateAtaValueElement = (id: keyof GroupAtaState): void => {
  const ataValueElement = document.getElementById(id) as HTMLValueElement | null
  if (ataValueElement) {
    ataValueElement.value =
      zoneMapping[zoneElement.value]?.[id]?.toString() ?? ''
  }
}

const refreshAtaValuesElement = (): void => {
  ataCapabilities.forEach(([ataKey]) => {
    updateAtaValueElement(ataKey)
  })
}

const createSmoke = (flame: HTMLDivElement, speed: number): void => {
  if (flame.isConnected && canvasCtx) {
    const { left, top, width } = flame.getBoundingClientRect()
    Array.from({ length: 11 }).forEach(() => {
      smokeParticles.push(
        new SmokeParticle(
          canvasCtx,
          left + width / FACTOR_TWO,
          top - parseFloat(getComputedStyle(flame).bottom),
        ),
      )
    })
    setTimeout(
      () => {
        createSmoke(flame, speed)
      },
      generateDelay(SMOKE_DELAY, SPEED_VERY_SLOW),
    )
  }
}

const generateSmoke = (speed: number): void => {
  if (canvasCtx) {
    ;({ innerHeight: canvas.height, innerWidth: canvas.width } = window)
    canvasCtx.clearRect(
      DEFAULT_RECT_X,
      DEFAULT_RECT_Y,
      canvas.width,
      canvas.height,
    )
    smokeParticles = smokeParticles.filter((particle) => {
      particle.update(speed)
      particle.draw()
      return (
        particle.size > SMOKE_PARTICLE_SIZE_MIN &&
        particle.opacity > SMOKE_PARTICLE_OPACITY_MIN &&
        particle.posY > SMOKE_PARTICLE_POS_Y_MIN
      )
    })
    smokeAnimationFrameId = requestAnimationFrame(() => {
      generateSmoke(speed)
    })
  }
}

const generateFlameAnimation = (
  flame: HTMLDivElement,
  speed: number,
): Animation => {
  const animation = flame.animate(
    [...Array.from({ length: 101 }).keys()].map(() => {
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
  createSmoke(flame, speed)
  return animation
}

const createFlame = (speed: number): void => {
  const flame = createAnimatedElement('flame')
  const [name, index] = flame.id.split('-')
  const previousElement = document.getElementById(
    `${name}-${String(Number(index) - INCREMENT)}`,
  )
  const previousLeft =
    previousElement ?
      parseFloat(previousElement.style.left)
    : -FLAME_INTERVAL * FACTOR_TWO
  flame.style.left = generateStyleString(
    {
      gap: FLAME_INTERVAL,
      min:
        previousLeft > window.innerWidth ?
          -FLAME_INTERVAL
        : previousLeft + FLAME_INTERVAL,
    },
    'px',
  )
  flame.style.fontSize = generateStyleString({ gap: 10, min: 50 }, 'px')
  animationElement.append(flame)
  generateFlameAnimation(flame, speed)
}

const generateFlames = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createFlame(speed)
        generateFlames(speed)
      },
      generateDelay(FLAME_DELAY, speed),
    ),
  )
}

const handleFireAnimation = (speed: number): void => {
  generateFlames(speed)
  generateSmoke(speed)
}

const generateSnowflakeAnimation = (
  snowflake: HTMLDivElement,
  speed: number,
): Animation => {
  const animation = snowflake.animate(
    [
      { transform: 'translateY(0) rotate(0deg)' },
      { transform: 'translateY(100vh) rotate(360deg)' },
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

const createSnowflake = (speed: number): void => {
  const snowflake = createAnimatedElement('snowflake')
  const [name, index] = snowflake.id.split('-')
  const previousElement = document.getElementById(
    `${name}-${String(Number(index) - INCREMENT)}`,
  )
  const previousLeft =
    previousElement ?
      parseFloat(previousElement.style.left)
    : -SNOWFLAKE_INTERVAL * FACTOR_TWO
  snowflake.style.left = generateStyleString(
    {
      gap: SNOWFLAKE_INTERVAL,
      min:
        previousLeft > window.innerWidth ?
          -SNOWFLAKE_INTERVAL
        : previousLeft + SNOWFLAKE_INTERVAL,
    },
    'px',
  )
  snowflake.style.fontSize = generateStyleString(
    { divisor: speed, gap: 10, min: 30 },
    'px',
  )
  snowflake.style.filter = `brightness(${generateStyleString(
    { gap: 20, min: 100 },
    '%',
  )})`
  animationElement.append(snowflake)
  generateSnowflakeAnimation(snowflake, speed)
}

const generateSnowflakes = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createSnowflake(speed)
        generateSnowflakes(speed)
      },
      generateDelay(SNOWFLAKE_DELAY, speed),
    ),
  )
}

const handleSnowAnimation = (speed: number): void => {
  generateSnowflakes(speed)
}

const generateSunExitAnimation = (sun: HTMLDivElement): Animation => {
  sunAnimation.enter?.cancel()
  const { bottom, left } = getComputedStyle(sun)
  const animation = sun.animate(
    [
      {
        bottom: `${String(parseFloat(bottom))}px`,
        left: `${String(parseFloat(left))}px`,
      },
      {
        bottom: `${String(window.innerHeight)}px`,
        left: `${String(window.innerWidth)}px`,
      },
    ],
    { duration: 5000, easing: 'ease-in', fill: 'forwards' },
  )
  animation.oncancel = (): void => {
    sunAnimation.exit = null
  }
  animation.onfinish = (): void => {
    sun.remove()
    sunAnimation.shine?.cancel()
    sunAnimation.exit = null
  }
  return animation
}

const generateSunEnterAnimation = (sun: HTMLDivElement): Animation => {
  sunAnimation.exit?.cancel()
  const { bottom, height, left, width } = getComputedStyle(sun)
  const animation = sun.animate(
    [
      {
        bottom: `${String(parseFloat(bottom))}px`,
        left: `${String(parseFloat(left))}px`,
      },
      {
        bottom: `${String(
          (window.innerHeight - parseFloat(height)) * SUN_BOTTOM_POS_Y_FACTOR,
        )}px`,
        left: `${String(
          (window.innerWidth - parseFloat(width)) / FACTOR_TWO,
        )}px`,
      },
    ],
    { duration: 5000, easing: 'ease-out', fill: 'forwards' },
  )
  animation.oncancel = (): void => {
    sunAnimation.enter = null
  }
  animation.onfinish = (): void => {
    sunAnimation.enter = null
  }
  return animation
}

const generateSunShineAnimation = (sun: HTMLDivElement): Animation => {
  const animation = sun.animate(
    [
      { filter: 'brightness(120%) blur(20px)', transform: 'rotate(0deg)' },
      { filter: 'brightness(120%) blur(20px)', transform: 'rotate(360deg)' },
    ],
    { duration: SUN_SHINE_DURATION, easing: 'linear', iterations: Infinity },
  )
  animation.oncancel = (): void => {
    sun.remove()
    sunAnimation.shine = null
  }
  return animation
}

const handleSunAnimation = (speed: number): void => {
  let sun = document.getElementById('sun-1') as HTMLDivElement | null
  if (!sun) {
    sun = createAnimatedElement('sun')
    animationElement.append(sun)
    sunAnimation.enter = generateSunEnterAnimation(sun)
  }
  if (!sunAnimation.shine) {
    sunAnimation.shine = generateSunShineAnimation(sun)
  }
  sunAnimation.shine.playbackRate = speed
}

const generateLeafAnimation = (
  leaf: HTMLDivElement,
  speed: number,
): Animation => {
  const loopStart = Math.floor(generateStyleNumber({ gap: 50, min: 10 }))
  const loopDuration = Math.floor(generateStyleNumber({ gap: 20, min: 20 }))
  const loopEnd = loopStart + loopDuration
  const loopRadius = generateStyleNumber({ gap: 40, min: 10 })
  const animation = leaf.animate(
    [...Array.from({ length: 101 }).keys()].map((index) => {
      const progress = (index - loopStart) / loopDuration
      const angle = progress * Math.PI * FACTOR_TWO
      const indexLoopRadius =
        index >= loopStart && index < loopEnd ? loopRadius : LEAF_NO_LOOP_RADIUS
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

const createLeaf = (speed: number): void => {
  const leaf = createAnimatedElement('leaf')
  const [name, index] = leaf.id.split('-')
  const previousElement = document.getElementById(
    `${name}-${String(Number(index) - INCREMENT)}`,
  )
  const previousTop =
    previousElement ?
      parseFloat(previousElement.style.top)
    : -LEAF_INTERVAL * FACTOR_TWO
  leaf.style.top = generateStyleString(
    {
      gap: LEAF_INTERVAL,
      min:
        previousTop > window.innerHeight ?
          -LEAF_INTERVAL
        : previousTop + LEAF_INTERVAL,
    },
    'px',
  )
  leaf.style.fontSize = generateStyleString({ gap: 10, min: 30 }, 'px')
  leaf.style.filter = `brightness(${generateStyleString(
    { gap: 50, min: 100 },
    '%',
  )})`
  animationElement.append(leaf)
  generateLeafAnimation(leaf, speed)
}

const generateLeaves = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createLeaf(speed)
        generateLeaves(speed)
      },
      generateDelay(LEAF_DELAY, speed),
    ),
  )
}

const handleWindAnimation = (speed: number): void => {
  generateLeaves(speed)
}

const getAtaValues = async <T extends keyof GroupAtaState>(
  homey: Homey,
  detailed = false,
): Promise<GroupAtaState | Record<T, GroupAtaState[T][]>> => {
  let endPoint = `/values/ata/${getZonePath()}`
  if (detailed) {
    endPoint += `?${new URLSearchParams({
      mode: 'detailed',
      status: 'on',
    } satisfies Required<GetAtaOptions>).toString()}`
  }
  return (await homey.api('GET', endPoint)) as Promise<
    GroupAtaState | Record<T, GroupAtaState[T][]>
  >
}

const getModes = async (homey: Homey): Promise<OperationMode[]> => {
  try {
    return (await getAtaValues(homey, true)).OperationMode as OperationMode[]
  } catch (_error) {
    return []
  }
}

const resetFireAnimation = async (
  homey: Homey,
  isSomethingOn: boolean,
  mode: number,
): Promise<void> => {
  if (
    isSomethingOn &&
    (HEAT_MODES.includes(mode) ||
      (mode === MODE_MIXED &&
        (await getModes(homey)).some((currentMode) =>
          HEAT_MODES.includes(currentMode),
        )))
  ) {
    if (smokeAnimationFrameId !== null) {
      cancelAnimationFrame(smokeAnimationFrameId)
      smokeAnimationFrameId = null
    }
    return
  }
  document.querySelectorAll('.flame').forEach((flame) => {
    setTimeout(
      () => {
        flame.remove()
      },
      generateDelay(FLAME_DELAY, SPEED_VERY_SLOW),
    )
  })
}

const resetSunAnimation = async (
  homey: Homey,
  isSomethingOn: boolean,
  mode: number,
): Promise<void> => {
  const sun = document.getElementById('sun-1') as HTMLDivElement | null
  if (
    sun &&
    (!isSomethingOn ||
      (mode !== MODE_DRY &&
        mode !== MODE_MIXED &&
        (await getModes(homey)).every(
          (currentMode: number) => currentMode !== MODE_DRY,
        )))
  ) {
    sunAnimation.exit = generateSunExitAnimation(sun)
  }
}

const resetAnimation = async (
  homey: Homey,
  isSomethingOn: boolean,
  mode: number,
): Promise<void> => {
  if (animationTimeouts.length) {
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts.length = 0
  }
  await resetFireAnimation(homey, isSomethingOn, mode)
  await resetSunAnimation(homey, isSomethingOn, mode)
}

const handleMixedAnimation = async (
  homey: Homey,
  speed: number,
): Promise<void> => {
  const modes = await getModes(homey)
  if (modes.includes(MODE_AUTO) || modes.includes(MODE_COOL)) {
    handleSnowAnimation(speed)
  }
  if (modes.includes(MODE_AUTO) || modes.includes(MODE_HEAT)) {
    handleFireAnimation(speed)
  }
  if (modes.includes(MODE_DRY)) {
    handleSunAnimation(speed)
  }
  if (modes.includes(MODE_FAN)) {
    handleWindAnimation(speed)
  }
}

const handleAnimation = async (
  homey: Homey,
  state: GroupAtaState,
): Promise<void> => {
  const { FanSpeed: speed, OperationMode: mode, Power: isOn } = state
  const isSomethingOn = isOn !== false
  const newSpeed = Number(speed ?? SPEED_MODERATE) || SPEED_MODERATE
  const newMode = Number(mode ?? null)
  await resetAnimation(homey, isSomethingOn, newMode)
  if (isSomethingOn) {
    switch (newMode) {
      case MODE_AUTO:
        handleFireAnimation(newSpeed)
        handleSnowAnimation(newSpeed)
        break
      case MODE_COOL:
        handleSnowAnimation(newSpeed)
        break
      case MODE_DRY:
        handleSunAnimation(newSpeed)
        break
      case MODE_FAN:
        handleWindAnimation(newSpeed)
        break
      case MODE_HEAT:
        handleFireAnimation(newSpeed)
        break
      case MODE_MIXED:
        await handleMixedAnimation(homey, newSpeed)
        break
      default:
    }
  }
}

const fetchAtaValues = async (homey: Homey): Promise<void> => {
  try {
    const state = (await getAtaValues(homey)) as GroupAtaState
    updateZoneMapping({ ...defaultAtaValues, ...state })
    refreshAtaValuesElement()
    unhide(hasZoneAtaDevicesElement)
    await handleAnimation(homey, state)
  } catch (_error) {
    hide(hasZoneAtaDevicesElement)
  }
}

const generateAtaValue = (
  homey: Homey,
  {
    id,
    type,
    values,
  }: {
    id: string
    type: string
    values?: readonly { id: string; label: string }[]
  },
): HTMLValueElement | null => {
  if (['boolean', 'enum'].includes(type)) {
    return createSelectElement(homey, id, values)
  }
  if (type === 'number') {
    return createInputElement({
      id,
      max:
        id in maxMapping ?
          maxMapping[id as keyof typeof maxMapping]
        : undefined,
      min:
        id in minMapping ?
          minMapping[id as keyof typeof minMapping]
        : undefined,
      type,
    })
  }
  return null
}

const generateAtaValues = (homey: Homey): void => {
  ataCapabilities.forEach(([id, { title, type, values }]) => {
    createValueElement(ataValuesElement, {
      title,
      valueElement: generateAtaValue(homey, { id, type, values }),
    })
  })
}

const generateZones = async (
  zones: Zone[],
  zoneType = 'buildings',
  level = FIRST_LEVEL,
): Promise<void> =>
  zones.reduce(async (acc, zone) => {
    await acc
    createOptionElement(zoneElement, {
      id: `${zoneType}_${String(zone.id)}`,
      label: `${'···'.repeat(level)} ${zone.name}`,
    })
    if ('areas' in zone && zone.areas) {
      await generateZones(zone.areas, 'areas', level + INCREMENT)
    }
    if ('floors' in zone && zone.floors) {
      await generateZones(zone.floors, 'floors', SECOND_LEVEL)
    }
  }, Promise.resolve())

const fetchBuildings = async (homey: Homey): Promise<void> => {
  try {
    const buildings = (await homey.api('GET', '/buildings')) as BuildingZone[]
    if (buildings.length) {
      generateAtaValues(homey)
      await generateZones(buildings)
      await fetchAtaValues(homey)
    }
  } catch (_error) {}
}

const fetchAtaCapabilities = async (homey: Homey): Promise<void> => {
  try {
    ataCapabilities = (await homey.api('GET', '/capabilities/ata')) as [
      keyof GroupAtaState,
      DriverCapabilitiesOptions,
    ][]
    defaultAtaValues = Object.fromEntries(
      ataCapabilities.map(([ataKey]) => [ataKey, null]),
    )
  } catch (_error) {}
}

const setAtaValues = async (homey: Homey): Promise<void> => {
  try {
    const state = buildAtaValuesBody()
    if (Object.keys(state).length) {
      await homey.api(
        'PUT',
        `/values/ata/${getZonePath()}`,
        state satisfies GroupAtaState,
      )
    }
  } catch (_error) {}
}

const addEventListeners = (homey: Homey): void => {
  zoneElement.addEventListener('change', () => {
    fetchAtaValues(homey).catch(() => {
      //
    })
  })
  refreshAtaValues.addEventListener('click', () => {
    homey.hapticFeedback()
    refreshAtaValuesElement()
  })
  updateAtaValues.addEventListener('click', () => {
    homey.hapticFeedback()
    setAtaValues(homey).catch(() => {
      //
    })
  })
  homey.on('deviceupdate', () => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout)
    }
    debounceTimeout = setTimeout(() => {
      fetchAtaValues(homey).catch(() => {
        //
      })
    }, DEBOUNCE_DELAY)
  })
}

// eslint-disable-next-line func-style
async function onHomeyReady(homey: Homey): Promise<void> {
  await setDocumentLanguage(homey)
  await fetchAtaCapabilities(homey)
  await fetchBuildings(homey)
  addEventListeners(homey)
  homey.ready()
}
