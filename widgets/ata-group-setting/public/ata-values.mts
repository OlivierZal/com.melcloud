import type { GroupState } from '@olivierzal/melcloud-api'

import type {
  DriverCapabilitiesOptions,
  Settings,
  ValueOf,
  Zone,
} from '../../../types/index.mts'
import { coolModes, Temperature } from './constants.mts'
import {
  type HTMLValueElement,
  booleanStrings,
  createOptionElement,
  getSelectElement,
  handleNumericInputElement,
} from './dom.mts'
import { type Homey, homeyApiGet, homeyApiPut } from './homey-api.mts'
import { getZoneId, getZoneName, getZonePath } from './zones.mts'

// ── DOM helpers ──

const elementTypes = new Set(['boolean', 'enum'])

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

// ── Value processing ──

const handleIntMin = (id: string, min: string): string =>
  (
    id === 'SetTemperature' &&
    coolModes.has(Number(getSelectElement('OperationMode').value))
  ) ?
    String(Temperature.cooling_min)
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

// ── AtaValueManager class ──

export class AtaValueManager {
  #ataCapabilities: [keyof GroupState, DriverCapabilitiesOptions][] = []
  readonly #ataValuesElement: HTMLDivElement
  #defaultAtaValues: Partial<Record<keyof GroupState, null>> = {}
  readonly #homey: Homey
  readonly #zoneElement: HTMLSelectElement
  readonly #zoneMapping: Partial<Record<string, Partial<GroupState>>> = {}
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
    this.#ataCapabilities = await homeyApiGet<
      [keyof GroupState, DriverCapabilitiesOptions][]
    >(this.#homey, '/capabilities/ata')
    this.#defaultAtaValues = Object.fromEntries(
      this.#ataCapabilities.map(([ataKey]) => [ataKey, null]),
    )
  }
  public async fetchValues(): Promise<GroupState> {
    const values = await homeyApiGet<GroupState>(
      this.#homey,
      `/values/ata/${this.#getZoneValue()}`,
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
    if (zones.length > 0) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOptionElement(this.#zoneElement, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        // eslint-disable-next-line no-await-in-loop -- Sequential: parent-child order required for tree rendering
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
    const body = this.#buildAtaValuesBody()
    if (Object.keys(body).length > 0) {
      await homeyApiPut(
        this.#homey,
        `/values/ata/${this.#getZoneValue()}`,
        body satisfies GroupState,
      )
    }
  }
  #buildAtaValuesBody(): GroupState {
    return Object.fromEntries(
      // eslint-disable-next-line unicorn/prefer-spread -- NodeListOf not iterable without DOM.Iterable lib
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
        max: id === 'SetTemperature' ? Temperature.max : undefined,
        min: id === 'SetTemperature' ? Temperature.min : undefined,
        type,
      })
    }
    return null
  }
  #getZoneValue(): string {
    return getZonePath(this.#zoneElement.value)
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
