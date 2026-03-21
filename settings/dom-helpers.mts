import type Homey from 'homey/lib/HomeySettings'

import {
  type HTMLValueElement,
  booleanStrings,
  createOptionElement,
  getInputElement,
  handleNumericInputElement,
} from './dom.mts'

export class NoDeviceError extends Error {
  public override name = 'NoDeviceError'

  public constructor(homey: Homey) {
    super(homey.__('settings.devices.none'))
  }
}

const frostProtectionTemperatureRange = { max: 16, min: 4 }
export const FROST_PROTECTION_TEMPERATURE_GAP = 2

export const commonElementTypes = new Set(['checkbox', 'dropdown'])
export const commonElementValueTypes = new Set(['boolean', 'number', 'string'])

export const disableButton = (id: string, value = true): void => {
  const element = document.querySelector(`#${id}`)
  if (value) {
    element?.classList.add('is-disabled')
    return
  }
  element?.classList.remove('is-disabled')
}

export const withDisablingButton = async (
  id: string,
  action: () => Promise<void>,
): Promise<void> => {
  disableButton(id)
  await action()
  disableButton(id, false)
}

export const hide = (element: HTMLDivElement, value = true): void => {
  element.classList.toggle('hidden', value)
}

const addTextToCheckbox = (
  labelElement: HTMLLabelElement,
  checkboxElement: HTMLInputElement,
  text: string,
): void => {
  const checkmarkSpanElement = document.createElement('span')
  checkmarkSpanElement.classList.add('homey-form-checkbox-checkmark')
  const textSpanElement = document.createElement('span')
  textSpanElement.classList.add('homey-form-checkbox-text')
  textSpanElement.textContent = text
  labelElement.append(checkboxElement, checkmarkSpanElement, textSpanElement)
}

const createLabelElement = (
  valueElement: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const isCheckbox = valueElement.type === 'checkbox'
  const labelElement = document.createElement('label')
  labelElement.classList.add(
    isCheckbox ? 'homey-form-checkbox' : 'homey-form-label',
  )
  ;({ id: labelElement.htmlFor } = valueElement)
  if (isCheckbox) {
    addTextToCheckbox(labelElement, valueElement, text)
  } else {
    labelElement.textContent = text
    labelElement.append(valueElement)
  }
  return labelElement
}

const createDivElement = (labelElement: HTMLLabelElement): HTMLDivElement => {
  const divElement = document.createElement('div')
  divElement.classList.add('homey-form-group')
  divElement.append(labelElement)
  return divElement
}

export const createValueElement = (
  parentElement: HTMLElement,
  {
    title,
    valueElement,
  }: { title: string; valueElement: HTMLValueElement | null },
  wrapWithDiv = true,
): void => {
  if (valueElement) {
    const labelElement = createLabelElement(valueElement, title)
    parentElement.append(
      wrapWithDiv ? createDivElement(labelElement) : labelElement,
    )
  }
}

export const createInputElement = ({
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
  value?: string | null
}): HTMLInputElement => {
  const inputElement = document.createElement('input')
  inputElement.classList.add('homey-form-input')
  inputElement.id = id
  inputElement.value = value ?? ''
  inputElement.type = type
  handleNumericInputElement(inputElement, { max, min })
  if (placeholder !== undefined) {
    inputElement.placeholder = placeholder
  }
  return inputElement
}

export const createLegendElement = (
  fieldSetElement: HTMLFieldSetElement,
  text?: string,
): void => {
  const legendElement = document.createElement('legend')
  legendElement.classList.add('homey-form-checkbox-set-title')
  if (text !== undefined) {
    legendElement.textContent = text
  }
  fieldSetElement.append(legendElement)
}

export const createCheckboxElement = (
  id: string,
  driverId: string,
): HTMLInputElement => {
  const checkboxElement = document.createElement('input')
  checkboxElement.classList.add('homey-form-checkbox-input')
  checkboxElement.type = 'checkbox'
  checkboxElement.id = `${id}__settings_${driverId}`
  return checkboxElement
}

export const createSelectElement = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const selectElement = document.createElement('select')
  selectElement.classList.add('homey-form-select')
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

export const int = (
  homey: Homey,
  { id, max, min, value }: HTMLInputElement,
): number => {
  const numberValue = Number(value)
  if (
    !Number.isFinite(numberValue) ||
    numberValue < Number(min) ||
    numberValue > Number(max)
  ) {
    throw new Error(
      homey.__('settings.intError', {
        max,
        min,
        name: homey.__(
          document.querySelector<HTMLLabelElement>(`label[for="${id}"]`)
            ?.textContent ?? '',
        ),
      }),
    )
  }
  return numberValue
}

export const initFrostProtectionMinElement = (): HTMLInputElement => {
  const element = getInputElement('min')
  element.min = String(frostProtectionTemperatureRange.min)
  element.max = String(
    frostProtectionTemperatureRange.max - FROST_PROTECTION_TEMPERATURE_GAP,
  )
  return element
}

export const initFrostProtectionMaxElement = (): HTMLInputElement => {
  const element = getInputElement('max')
  element.min = String(
    frostProtectionTemperatureRange.min + FROST_PROTECTION_TEMPERATURE_GAP,
  )
  element.max = String(frostProtectionTemperatureRange.max)
  return element
}
