import type HomeyWidget from 'homey/lib/HomeyWidget'

import { getErrorMessage } from '../lib/get-error-message.mts'
import {
  type PickerZone,
  getSubzones,
  getZoneId,
  getZoneName,
} from './zones.mts'

export type HTMLValueElement = HTMLInputElement | HTMLSelectElement

export const booleanStrings: string[] = [
  'false',
  'true',
] satisfies `${boolean}`[]

const getElement = <T extends HTMLElement>(
  id: string,
  elementConstructor: new () => T,
  elementType: string,
): T => {
  const element = document.querySelector(`#${id}`)
  if (element === null) {
    throw new TypeError(`Element with id \`${id}\` not found`)
  }
  if (!(element instanceof elementConstructor)) {
    throw new TypeError(`Element with id \`${id}\` is not a ${elementType}`)
  }
  return element
}

export const getButton = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

export const getDetails = (id: string): HTMLDetailsElement =>
  getElement(id, HTMLDetailsElement, 'details')

export const getDiv = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

export const getFieldset = (id: string): HTMLFieldSetElement =>
  getElement(id, HTMLFieldSetElement, 'fieldset')

export const getInput = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

export const getSelect = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

export const getSpan = (id: string): HTMLSpanElement =>
  getElement(id, HTMLSpanElement, 'span')

export const createOption = (
  select: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (select.querySelector(`option[value="${CSS.escape(id)}"]`) === null) {
    select.append(new Option(label, id))
  }
}

// Fallback options for a generated select: the translated boolean pair,
// shared by every select whose capability declares no explicit values.
export const booleanOptions = (
  homey: Pick<HomeyWidget, '__'>,
): { id: string; label: string }[] =>
  booleanStrings.map((value) => ({
    id: value,
    label: homey.__(`settings.boolean.${value}`),
  }))

// Shared form-control builders for the generated settings and widget
// forms. The optional class hooks carry the settings page's
// `homey-form-*` decoration; the widgets style the bare elements through
// element selectors instead.
export const createLabel = (
  formControl: HTMLValueElement,
  text: string,
  className?: string,
): HTMLLabelElement => {
  const label = document.createElement('label')
  if (className !== undefined) {
    label.classList.add(className)
  }
  label.htmlFor = formControl.id
  label.textContent = text
  label.append(formControl)
  return label
}

export const appendFormControl = (
  parent: HTMLElement,
  {
    formControl,
    title,
  }: { formControl: HTMLValueElement | null; title: string },
): void => {
  if (formControl !== null) {
    parent.append(createLabel(formControl, title))
  }
}

export const createInput = ({
  className,
  id,
  max,
  min,
  placeholder,
  type,
  value,
}: {
  id: string
  type: string
  className?: string
  max?: number | undefined
  min?: number | undefined
  placeholder?: string | undefined
  value?: string | null
}): HTMLInputElement => {
  const input = document.createElement('input')
  if (className !== undefined) {
    input.classList.add(className)
  }
  input.id = id
  input.value = value ?? ''
  input.type = type
  configureNumericInput(input, { max, min })
  if (placeholder !== undefined) {
    input.placeholder = placeholder
  }
  return input
}

export const createSelect = (
  id: string,
  values: readonly { id: string; label: string }[],
  className?: string,
): HTMLSelectElement => {
  const select = document.createElement('select')
  if (className !== undefined) {
    select.classList.add(className)
  }
  select.id = id
  for (const option of [{ id: '', label: '' }, ...values]) {
    createOption(select, option)
  }
  return select
}

// Shared form-value reader: checkbox → tri-state, bounded number input →
// the caller's number strategy (the settings page throws on an
// out-of-range value, the ATA widget clamps it), boolean string →
// boolean, anything else → number when finite, else the raw string.
export const parseFormValue = (
  element: HTMLValueElement,
  parseNumber: (input: HTMLInputElement) => number,
): boolean | number | string | null => {
  if (element.value !== '') {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return parseNumber(element)
    }
    if (booleanStrings.includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}

// Fills a zone select by walking the picker tree in list order, one
// option per zone, subzones right below their parent.
export const populateZoneOptions = (
  select: HTMLSelectElement,
  zones: readonly PickerZone[],
): void => {
  for (const zone of zones) {
    const { id, level, model, name } = zone
    createOption(select, {
      id: getZoneId(id, model),
      label: getZoneName(name, level),
    })
    populateZoneOptions(select, getSubzones(zone))
  }
}

// The Homey runtime only translates `data-i18n` text content, not
// attributes. Elements without visible text pair `data-i18n-aria-label`
// (translated here at startup) with a static English `aria-label` that
// serves as the pre-script default — mirroring the default-text-then-
// translate pattern used for visible content.
export const translateAriaLabels = (
  translate: (key: string) => string,
): void => {
  for (const element of document.querySelectorAll<HTMLElement>(
    '[data-i18n-aria-label]',
  )) {
    const {
      dataset: { i18nAriaLabel },
    } = element
    if (i18nAriaLabel !== undefined && i18nAriaLabel !== '') {
      element.ariaLabel = translate(i18nAriaLabel)
    }
  }
}

export const configureNumericInput = (
  input: HTMLInputElement,
  { max, min }: { max?: number | undefined; min?: number | undefined },
): void => {
  if (input.type !== 'number') {
    return
  }

  input.setAttribute('inputmode', 'numeric')
  if (min !== undefined) {
    input.min = String(min)
  }
  if (max !== undefined) {
    input.max = String(max)
  }
}

/**
 * Clears the `#init_error` element: called when the init work completes,
 * so a load that outlives its timeout removes the degraded state once it
 * eventually succeeds.
 */
export const hideInitError = (): void => {
  const element = document.querySelector('#init_error')
  if (element instanceof HTMLElement) {
    element.hidden = true
    element.textContent = ''
  }
}

/**
 * Reveals the static `#init_error` element with the failure message: the
 * webview stays visible (`ready()` fires in the caller's `finally`), so
 * the user sees why the page is degraded instead of an endless overlay.
 * @param error - The init failure to display.
 */
export const showInitError = (error: unknown): void => {
  const element = document.querySelector('#init_error')
  if (element instanceof HTMLElement) {
    element.textContent = getErrorMessage(error)
    element.hidden = false
  }
}
