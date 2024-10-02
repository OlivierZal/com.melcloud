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

const FIRST_LEVEL = 0
const SECOND_LEVEL = 1
const LEVEL_INCREMENT = 1

const minMapping = { SetTemperature: 10 } as const
const maxMapping = { SetTemperature: 31 } as const
const MIN_SET_TEMPERATURE_COOLING = 16

const MODE_AUTO = 8
const MODE_COOL = 3
const MODE_DRY = 2

const zoneMapping: Partial<
  Record<string, Partial<GroupAtaState & ZoneSettings>>
> = {}

const refreshAtaValues = document.getElementById(
  'refresh_values_melcloud',
) as HTMLButtonElement
const updateAtaValues = document.getElementById(
  'apply_values_melcloud',
) as HTMLButtonElement

const hasZoneAtaDevicesElement = document.getElementById(
  'has_zone_ata_devices',
) as HTMLDivElement
const ataValuesElement = document.getElementById(
  'values_melcloud',
) as HTMLDivElement

const zoneElement = document.getElementById('zones') as HTMLSelectElement

let ataCapabilities: [keyof GroupAtaState, DriverCapabilitiesOptions][] = []
let defaultAtaValues: Partial<Record<keyof GroupAtaState, null>> = {}

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

const handleIntMin = (id: string, min: string): string => {
  if (id === 'SetTemperature') {
    const modeElement = document.getElementById(
      'OperationMode',
    ) as HTMLSelectElement
    if ([MODE_AUTO, MODE_COOL, MODE_DRY].includes(Number(modeElement.value))) {
      return String(MIN_SET_TEMPERATURE_COOLING)
    }
  }
  return min
}

const int = (
  homey: Homey,
  { id, max, min, value }: HTMLInputElement,
): number => {
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

const processValue = (
  homey: Homey,
  element: HTMLValueElement,
): ValueOf<Settings> => {
  if (element.value) {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return int(homey, element)
    }
    if (['false', 'true'].includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}

const buildAtaValuesBody = (homey: Homey): GroupAtaState => {
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
      .map((element) => [element.id, processValue(homey, element)]),
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

const setAnimation = (): void => {
  //
}

const generateAtaValues = (homey: Homey): void => {
  ataCapabilities.forEach(([id, { title, type, values }]) => {
    createValueElement(ataValuesElement, {
      title,
      valueElement: generateAtaValue(homey, { id, type, values }),
    })
  })
  ;(
    document.getElementById('OperationMode') as HTMLSelectElement
  ).addEventListener('change', setAnimation)
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
      await generateZones(zone.areas, 'areas', level + LEVEL_INCREMENT)
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
    const body = buildAtaValuesBody(homey)
    if (Object.keys(body).length) {
      await homey.api(
        'PUT',
        `/drivers/melcloud/${zoneElement.value.replace('_', '/')}`,
        body satisfies GroupAtaState,
      )
      updateZoneMapping(body)
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
  setAnimation()
  homey.ready()
}
