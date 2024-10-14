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

const DEFAULT_MULTIPLIER = 1
const MINIMUM_DIVISOR = 1

const START_ANGLE = 0
const END_ANGLE_MULTIPLIER = 2
const SIZE_DIVISOR_FOR_BLUR = 10

const generateRandomNumber = ({
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
  ((divisor ?? MINIMUM_DIVISOR) || MINIMUM_DIVISOR)

class SmokeParticle {
  public opacity = generateRandomNumber({ gap: 0.05, min: 0.05 })

  public posY: number

  public size = generateRandomNumber({ gap: 2, min: 2 })

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
    this.#speedX = generateRandomNumber({ gap: 0.2, min: -0.1 })
    this.#speedY = generateRandomNumber({ gap: 0.6, min: 0.2 })
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
    this.#ctx.filter = `blur(${String(this.size / SIZE_DIVISOR_FOR_BLUR)}px)`
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
const HEAT_MODES = [MODE_AUTO, MODE_HEAT, MODE_MIXED]

const SPEED_VERY_SLOW = 1
const SPEED_MODERATE = 3
const SPEED_VERY_FAST = 5
const SPEED_FACTOR_MIN = 1
const SPEED_FACTOR_MAX = 50

const DEFAULT_RECT_Y = 0
const DEFAULT_RECT_X = 0
const FLAME_WINDOW_MARGIN = 20

const FLAME_DELAY = 1000
const LEAF_DELAY = 1000
const SMOKE_DELAY = 200
const SNOWFLAKE_DELAY = 1000

const LEAF_NO_LOOP_RADIUS = 0
const SMOKE_PARTICLE_SIZE_MIN = 0.1
const SMOKE_PARTICLE_OPACITY_MIN = 0
const SMOKE_PARTICLE_POS_Y_MIN = -50

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
const hasZoneAtaDevicesElement = document.getElementById(
  'has_zone_ata_devices',
) as HTMLDivElement
const ataValuesElement = document.getElementById(
  'values_melcloud',
) as HTMLDivElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement

const animationTimeouts: NodeJS.Timeout[] = []
const smokeIntervals = new Map<string, NodeJS.Timeout>()

let ataCapabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][] = []
let defaultAtaValues: Partial<Record<keyof GroupAtaState, null>> = {}

let smokeAnimationFrameId: number | null = null
let smokeParticles: SmokeParticle[] = []

const createAnimationMapping = (): Record<
  AnimatedElement,
  { readonly innerHTML: string; readonly getIndex?: () => number }
> => {
  let flameIndex = 0
  let leafIndex = 0
  return {
    flame: {
      getIndex: () => (flameIndex += INCREMENT),
      innerHTML: '🔥',
    },
    leaf: {
      getIndex: () => (leafIndex += INCREMENT),
      innerHTML: '🍁',
    },
    snowflake: {
      innerHTML: '❄',
    },
    sun: {
      innerHTML: '☀',
    },
  }
}

const getZonePath = (): string => zoneElement.value.replace('_', '/')

const generateRandomString = (
  params: { gap: number; min: number; divisor?: number; multiplier?: number },
  unit = '',
): string => `${String(generateRandomNumber(params))}${unit}`

const generateRandomDelay = (delay: number, speed: number): number =>
  (Math.random() * delay) /
  (SPEED_FACTOR_MIN *
    (SPEED_FACTOR_MAX / SPEED_FACTOR_MIN) **
      ((speed - SPEED_VERY_SLOW) / (SPEED_VERY_FAST - SPEED_VERY_SLOW)) ||
    MINIMUM_DIVISOR)

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

const animationMapping = createAnimationMapping()

const createAnimatedElement = (name: AnimatedElement): HTMLDivElement => {
  const element = document.createElement('div')
  element.classList.add(name)
  if (name in animationMapping) {
    const { [name]: mapping } = animationMapping
    ;({ innerHTML: element.innerHTML } = mapping)
    if (mapping.getIndex) {
      element.id = `${name}-${String(mapping.getIndex())}`
    }
  }
  return element
}

const createSmoke = (posX: number, posY: number): void => {
  if (canvasCtx) {
    Array.from({ length: 11 }).forEach(() => {
      smokeParticles.push(new SmokeParticle(canvasCtx, posX, posY))
    })
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

const generateFlameKeyframes = ({ id, style }: HTMLDivElement): void => {
  style.animationName = `flicker-${id}`
  const keyframes = [...Array.from({ length: 101 }).keys()]
    .map((index) => {
      const scaleX = generateRandomString({ gap: 0.4, min: 0.8 })
      const scaleY = generateRandomString({ gap: 0.4, min: 0.8 })
      const rotate = generateRandomString({ gap: 12, min: -6 }, 'deg')
      const opacity = generateRandomString({ gap: 0.4, min: 0.8 })
      const brightness = generateRandomString({ gap: 40, min: 100 }, '%')
      return `${String(index)}% {
          transform: scale(${scaleX}, ${scaleY}) rotate(${rotate});
          opacity: ${opacity};
          filter: brightness(${brightness});
        }`
    })
    .join('\n')
  const [styleSheet] = Array.from(document.styleSheets)
  styleSheet.insertRule(
    `@keyframes ${style.animationName} {
      ${keyframes}
    }`,
    styleSheet.cssRules.length,
  )
}

const generateFlameStyle = (element: HTMLDivElement, speed: number): void => {
  const { id, style } = element
  const [name, index] = id.split('-')
  const previousElement = document.getElementById(
    `${name}-${String(Number(index) - INCREMENT)}`,
  )
  const previousLeft =
    previousElement ?
      parseFloat(previousElement.style.left)
    : -FLAME_WINDOW_MARGIN * FACTOR_TWO
  style.left = generateRandomString(
    {
      gap: FLAME_WINDOW_MARGIN,
      min:
        previousLeft > window.innerWidth ?
          -FLAME_WINDOW_MARGIN
        : previousLeft + FLAME_WINDOW_MARGIN,
    },
    'px',
  )
  style.fontSize = generateRandomString({ gap: 10, min: 35 }, 'px')
  style.animationDuration = generateRandomString(
    { divisor: speed, gap: 10, min: 20 },
    's',
  )
  generateFlameKeyframes(element)
}

const createFlame = (speed: number): void => {
  const flame = createAnimatedElement('flame')
  generateFlameStyle(flame, speed)
  animationElement.append(flame)
  smokeIntervals.set(
    flame.id,
    setInterval(
      () => {
        if (!flame.isConnected) {
          clearInterval(smokeIntervals.get(flame.id))
          smokeIntervals.delete(flame.id)
          return
        }
        const { left, top, width } = flame.getBoundingClientRect()
        createSmoke(
          left + width / FACTOR_TWO,
          top - parseFloat(getComputedStyle(flame).bottom),
        )
      },
      generateRandomDelay(SMOKE_DELAY, speed),
    ),
  )
  flame.addEventListener('animationend', () => {
    clearInterval(smokeIntervals.get(flame.id))
    smokeIntervals.delete(flame.id)
    flame.remove()
  })
}

const generateFlames = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createFlame(speed)
        generateFlames(speed)
      },
      generateRandomDelay(FLAME_DELAY, speed),
    ),
  )
}

const startFireAnimation = (speed: number): void => {
  generateFlames(speed)
  generateSmoke(speed)
}

const createSnowflake = (speed: number): void => {
  const snowflake = createAnimatedElement('snowflake')
  snowflake.style.left = generateRandomString(
    { gap: window.innerWidth, min: 0 },
    'px',
  )
  snowflake.style.fontSize = generateRandomString(
    { divisor: speed, gap: 10, min: 10 },
    'px',
  )
  snowflake.style.animationDuration = generateRandomString(
    { divisor: speed, gap: 15, min: 5 },
    's',
  )
  snowflake.style.opacity = generateRandomString({ gap: 0.5, min: 0.5 })
  animationElement.append(snowflake)
  snowflake.addEventListener('animationend', () => {
    snowflake.remove()
  })
}

const generateSnowflakes = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createSnowflake(speed)
        generateSnowflakes(speed)
      },
      generateRandomDelay(SNOWFLAKE_DELAY, speed),
    ),
  )
}

const startSnowAnimation = (speed: number): void => {
  generateSnowflakes(speed)
}

const startSunAnimation = (): void => {
  //
}

const generateLeafKeyframes = ({ id, style }: HTMLDivElement): void => {
  style.animationName = `blow-${id}`
  const loopStart = Math.floor(generateRandomNumber({ gap: 50, min: 10 }))
  const loopDuration = Math.floor(generateRandomNumber({ gap: 20, min: 20 }))
  const loopEnd = loopStart + loopDuration
  const loopRadius = generateRandomNumber({ gap: 40, min: 10 })
  const keyframes = [...Array.from({ length: 101 }).keys()]
    .map((index) => {
      const indexLoopRadius =
        index >= loopStart && index < loopEnd ? loopRadius : LEAF_NO_LOOP_RADIUS
      const progress = (index - loopStart) / loopDuration
      const angle = progress * Math.PI * FACTOR_TWO
      const translateX = `${String(
        index * FACTOR_FIVE + indexLoopRadius * Math.sin(angle),
      )}px`
      const translateY = `${String(
        -(index * FACTOR_TWO - indexLoopRadius * Math.cos(angle)),
      )}px`
      const rotate = generateRandomString({ gap: 45, min: index }, 'deg')
      const oscillate =
        indexLoopRadius > LEAF_NO_LOOP_RADIUS ?
          ` translate(${String((indexLoopRadius / FACTOR_FIVE) * Math.sin(angle * FACTOR_FIVE))}px, 0px)`
        : ''
      return `${String(index)}% {
          transform: translate(${translateX}, ${translateY}) rotate(${rotate})${oscillate};
        }`
    })
    .join('\n')
  const [styleSheet] = Array.from(document.styleSheets)
  styleSheet.insertRule(
    `@keyframes ${style.animationName} {
      ${keyframes}
    }`,
    styleSheet.cssRules.length,
  )
}

const generateLeafStyle = (element: HTMLDivElement, speed: number): void => {
  const { style } = element
  style.top = generateRandomString({ gap: window.innerHeight, min: 0 }, 'px')
  style.fontSize = generateRandomString({ gap: 15, min: 20 }, 'px')
  style.opacity = generateRandomString({ gap: 0.5, min: 0.5 })
  style.animationDuration = generateRandomString(
    { divisor: speed, gap: 5, min: 3 },
    's',
  )
  generateLeafKeyframes(element)
}

const createLeaf = (speed: number): void => {
  const leaf = createAnimatedElement('leaf')
  generateLeafStyle(leaf, speed)
  animationElement.append(leaf)
  leaf.addEventListener('animationend', () => {
    leaf.remove()
  })
}

const generateLeaves = (speed: number): void => {
  animationTimeouts.push(
    setTimeout(
      () => {
        createLeaf(speed)
        generateLeaves(speed)
      },
      generateRandomDelay(LEAF_DELAY, speed),
    ),
  )
}

const startWindAnimation = (speed: number): void => {
  generateLeaves(speed)
}

const resetAnimation = (
  isSomethingOn: boolean,
  speed: number,
  mode: number,
): void => {
  if (animationTimeouts.length) {
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts.length = 0
  }
  ;[...smokeIntervals].forEach(([id, value]) => {
    setTimeout(
      () => {
        clearInterval(value)
        smokeIntervals.delete(id)
      },
      generateRandomDelay(FLAME_DELAY, speed),
    )
  })
  if (isSomethingOn && HEAT_MODES.includes(mode)) {
    if (smokeAnimationFrameId !== null) {
      cancelAnimationFrame(smokeAnimationFrameId)
      smokeAnimationFrameId = null
    }
  } else {
    document.querySelectorAll('.flame').forEach((element) => {
      element.remove()
    })
  }
}

const handleMixedAnimation = async (
  homey: Homey,
  speed: number,
): Promise<void> => {
  const { OperationMode: modes } = (await homey.api(
    'GET',
    `/values/ata/${getZonePath()}?${new URLSearchParams({
      mode: 'detailed',
      status: 'on',
    } satisfies Required<GetAtaOptions>).toString()}`,
  )) as { OperationMode: OperationMode[] }
  if (modes.includes(MODE_AUTO) || modes.includes(MODE_COOL)) {
    startSnowAnimation(speed)
  }
  if (modes.includes(MODE_AUTO) || modes.includes(MODE_HEAT)) {
    startFireAnimation(speed)
  }
  if (modes.includes(MODE_DRY)) {
    startSunAnimation()
  }
  if (modes.includes(MODE_FAN)) {
    startWindAnimation(speed)
  }
}

const handleAnimation = async (
  homey: Homey,
  data: GroupAtaState,
): Promise<void> => {
  const { FanSpeed: speed, OperationMode: mode, Power: isOn } = data
  const isSomethingOn = isOn !== false
  const newSpeed = Number(speed ?? SPEED_MODERATE) || SPEED_MODERATE
  const newMode = Number(mode ?? null)
  resetAnimation(isSomethingOn, newSpeed, newMode)
  if (isSomethingOn) {
    switch (newMode) {
      case MODE_AUTO:
        startFireAnimation(newSpeed)
        startSnowAnimation(newSpeed)
        break
      case MODE_COOL:
        startSnowAnimation(newSpeed)
        break
      case MODE_DRY:
        startSunAnimation()
        break
      case MODE_FAN:
        startWindAnimation(newSpeed)
        break
      case MODE_HEAT:
        startFireAnimation(newSpeed)
        break
      default:
        await handleMixedAnimation(homey, newSpeed)
    }
  }
}

const fetchAtaValues = async (homey: Homey): Promise<void> => {
  try {
    const state = (await homey.api(
      'GET',
      `/values/ata/${getZonePath()}`,
    )) as GroupAtaState
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
    const body = buildAtaValuesBody()
    if (Object.keys(body).length) {
      await homey.api(
        'PUT',
        `/values/ata/${getZonePath()}`,
        body satisfies GroupAtaState,
      )
      updateZoneMapping(body)
      await handleAnimation(homey, body)
    }
  } catch (_error) {
  } finally {
    refreshAtaValuesElement()
  }
}

const addEventListeners = (homey: Homey): void => {
  zoneElement.addEventListener('change', () => {
    fetchAtaValues(homey).catch(() => {
      //
    })
  })
  refreshAtaValues.addEventListener('click', () => {
    refreshAtaValuesElement()
  })
  updateAtaValues.addEventListener('click', () => {
    setAtaValues(homey).catch(() => {
      //
    })
  })
  homey.on('deviceUpdate', () => {
    fetchAtaValues(homey).catch(() => {
      //
    })
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
