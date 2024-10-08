import type { GroupAtaState, ZoneSettings } from '@olivierzal/melcloud-api'
import type Homey from 'homey/lib/HomeyWidget'

import type {
  BuildingZone,
  DriverCapabilitiesOptions,
  Settings,
  ValueOf,
  Zone,
} from '../../../types'

type HTMLValueElement = HTMLInputElement | HTMLSelectElement

const DEFAULT_MULTIPLIER = 1
const DIVISOR_FOR_HALF = 2
const INCREMENT = 1
const MINIMUM_DIVISOR = 1

const FIRST_LEVEL = 0
const SECOND_LEVEL = 1

const minMapping = { SetTemperature: 10 } as const
const maxMapping = { SetTemperature: 31 } as const
const MIN_SET_TEMPERATURE_COOLING = 16

const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2
const MODE_FAN = 7
const MODE_HEAT = 1

const SPEED_VERY_SLOW = 1
const SPEED_MODERATE = 3
const SPEED_VERY_FAST = 5
const SPEED_FACTOR_MIN = 1
const SPEED_FACTOR_MAX = 50

const FIRE_DELAY = 1000
const SNOW_DELAY = 500
const SMOKE_BOTTOM = 50
const SMOKE_SCALE_MIN = 1
const SMOKE_SCALE_DIVISOR = 100
const SMOKE_OPACITY_MAX = 1
const SMOKE_OPACITY_DIVISOR = 100

const zoneMapping: Partial<
  Record<string, Partial<GroupAtaState & ZoneSettings>>
> = {}

const refreshAtaValues = document.getElementById(
  'refresh_values_melcloud',
) as HTMLButtonElement
const updateAtaValues = document.getElementById(
  'apply_values_melcloud',
) as HTMLButtonElement

const animationElement = document.getElementById('animation') as HTMLDivElement
const hasZoneAtaDevicesElement = document.getElementById(
  'has_zone_ata_devices',
) as HTMLDivElement
const ataValuesElement = document.getElementById(
  'values_melcloud',
) as HTMLDivElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement

let ataCapabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][] = []
let defaultAtaValues: Partial<Record<keyof GroupAtaState, null>> = {}

let animationTimeouts: NodeJS.Timeout[] = []
let flameIndex = 0

const generateRandomString = ({
  divisor,
  gap,
  min,
  multiplier,
  unit,
}: {
  gap: number
  min: number
  divisor?: number
  multiplier?: number
  unit?: string
}): string =>
  `${String(
    ((Math.random() * gap + min) * (multiplier ?? DEFAULT_MULTIPLIER)) /
      ((divisor ?? MINIMUM_DIVISOR) || MINIMUM_DIVISOR),
  )}${unit ?? ''}`

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
  labelElement.htmlFor = valueElement.id
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

const updateZoneMapping = (
  data: Partial<GroupAtaState>,
  zone = zoneElement.value,
): void => {
  zoneMapping[zone] = { ...zoneMapping[zone], ...data }
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

const generateSmokeKeyframes = (style: CSSStyleDeclaration): void => {
  style.animationName = `rise-${String(flameIndex)}`
  const keyframes = [...Array.from({ length: 101 }).keys()]
    .map((index) => {
      const translateX = `${String(Math.sin(index) * Math.random())}vh`
      const translateY = `${String(-index)}vh`
      const scaleX = generateRandomString({
        gap: 0.4,
        min: SMOKE_SCALE_MIN + index / SMOKE_SCALE_DIVISOR,
      })
      const scaleY = generateRandomString({
        gap: 0.4,
        min: SMOKE_SCALE_MIN + index / SMOKE_SCALE_DIVISOR,
      })
      const rotate = generateRandomString({ gap: 12, min: -6, unit: 'deg' })
      const opacity = String(SMOKE_OPACITY_MAX - index / SMOKE_OPACITY_DIVISOR)
      const brightness = generateRandomString({ gap: 40, min: 100, unit: '%' })
      return `${String(index)}% {
          transform: translate(${translateX}, ${translateY}) scale(${scaleX}, ${scaleY}) rotate(${rotate});
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

const createSmoke = (
  {
    height,
    left,
    width,
  }: { bottom: number; height: number; left: number; width: number },
  speed: number,
): void => {
  const smoke = document.createElement('div')
  smoke.classList.add('smoke')
  smoke.style.width = generateRandomString({ gap: 20, min: 10, unit: 'px' })
  smoke.style.height = generateRandomString({ gap: 20, min: 10, unit: 'px' })
  smoke.style.animationDuration = generateRandomString({
    divisor: speed,
    gap: 5,
    min: 5,
    unit: 's',
  })
  generateSmokeKeyframes(smoke.style)
  animationElement.append(smoke)
  smoke.style.left = `${String(
    left + (width - smoke.getBoundingClientRect().width) / DIVISOR_FOR_HALF,
  )}px`
  smoke.style.bottom = `${String(
    height -
      SMOKE_BOTTOM -
      smoke.getBoundingClientRect().height / DIVISOR_FOR_HALF,
  )}px`
  smoke.addEventListener('animationend', () => {
    smoke.remove()
  })
}

const generateFlameKeyframes = (style: CSSStyleDeclaration): void => {
  flameIndex += INCREMENT
  style.animationName = `flicker-${String(flameIndex)}`
  const keyframes = [...Array.from({ length: 101 }).keys()]
    .map((index) => {
      const scaleX = generateRandomString({ gap: 0.4, min: 0.8 })
      const scaleY = generateRandomString({ gap: 0.4, min: 0.8 })
      const rotate = generateRandomString({ gap: 12, min: -6, unit: 'deg' })
      const opacity = generateRandomString({ gap: 0.4, min: 0.8 })
      const brightness = generateRandomString({ gap: 40, min: 100, unit: '%' })
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

const createFlame = (speed: number): void => {
  const flame = document.createElement('div')
  flame.classList.add('flame')
  flame.innerHTML = '🔥'
  flame.style.left = generateRandomString({
    gap: window.innerWidth,
    min: -50,
    unit: 'px',
  })
  flame.style.fontSize = generateRandomString({
    gap: 10,
    min: 60,
    unit: 'px',
  })
  flame.style.animationDuration = generateRandomString({
    divisor: speed,
    gap: 10,
    min: 20,
    unit: 's',
  })
  generateFlameKeyframes(flame.style)
  animationElement.append(flame)
  createSmoke(flame.getBoundingClientRect(), speed)
  flame.addEventListener('animationend', () => {
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
      generateRandomDelay(FIRE_DELAY, speed),
    ),
  )
}

const startFireAnimation = (speed: number): void => {
  generateFlames(speed)
}

const createSnowflake = (speed: number): void => {
  const snowflake = document.createElement('div')
  snowflake.classList.add('snowflake')
  snowflake.innerHTML = '❄'
  snowflake.style.left = generateRandomString({
    gap: window.innerWidth,
    min: 0,
    unit: 'px',
  })
  snowflake.style.fontSize = generateRandomString({
    divisor: speed,
    gap: 10,
    min: 10,
    unit: 'px',
  })
  snowflake.style.animationDuration = generateRandomString({
    divisor: speed,
    gap: 15,
    min: 5,
    unit: 's',
  })
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
      generateRandomDelay(SNOW_DELAY, speed),
    ),
  )
}

const startSnowAnimation = (speed: number): void => {
  generateSnowflakes(speed)
}

const startSunAnimation = (): void => {
  //
}

const startWindAnimation = (): void => {
  //
}

const handleAnimation = (data: GroupAtaState): void => {
  if (animationTimeouts.length) {
    animationTimeouts.forEach(clearTimeout)
    animationTimeouts = []
  }
  const { FanSpeed: speed, OperationMode: mode, Power: isOn } = data
  if (isOn !== false) {
    const newSpeed = Number(speed ?? SPEED_MODERATE) || SPEED_MODERATE
    switch (Number(mode)) {
      case MODE_AUTO:
      case MODE_DRY:
        startSunAnimation()
        break
      case MODE_COOL:
        startSnowAnimation(newSpeed)
        break
      case MODE_FAN:
        startWindAnimation()
        break
      case MODE_HEAT:
        startFireAnimation(newSpeed)
        break
      default:
    }
  }
}

const fetchAtaValues = async (
  homey: Homey,
  zone = zoneElement.value,
): Promise<void> => {
  try {
    const state = (await homey.api(
      'GET',
      `/drivers/melcloud/${zone.replace('_', '/')}`,
    )) as GroupAtaState
    updateZoneMapping({ ...defaultAtaValues, ...state }, zone)
    refreshAtaValuesElement()
    unhide(hasZoneAtaDevicesElement)
    handleAnimation(state)
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
    ataCapabilities = (await homey.api(
      'GET',
      '/capabilities/drivers/melcloud',
    )) as [keyof GroupAtaState, DriverCapabilitiesOptions][]
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
        `/drivers/melcloud/${zoneElement.value.replace('_', '/')}`,
        body satisfies GroupAtaState,
      )
      updateZoneMapping(body)
      handleAnimation(body)
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
