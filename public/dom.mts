export type HTMLValueElement = HTMLInputElement | HTMLSelectElement

export const booleanStrings: string[] = [
  'false',
  'true',
] satisfies `${boolean}`[]

export const getElement = <T extends HTMLElement>(
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

export const getButtonElement = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

export const getCanvasElement = (id: string): HTMLCanvasElement =>
  getElement(id, HTMLCanvasElement, 'canvas')

export const getDivElement = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

export const getInputElement = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

export const getLabelElement = (id: string): HTMLLabelElement =>
  getElement(id, HTMLLabelElement, 'label')

export const getSelectElement = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

export const createOptionElement = (
  selectElement: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!selectElement.querySelector(`option[value="${id}"]`)) {
    selectElement.append(new Option(label, id))
  }
}

export const handleNumericInputElement = (
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
