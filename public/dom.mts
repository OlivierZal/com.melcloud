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

export const getButton = (id: string): HTMLButtonElement =>
  getElement(id, HTMLButtonElement, 'button')

export const getCanvas = (id: string): HTMLCanvasElement =>
  getElement(id, HTMLCanvasElement, 'canvas')

export const getDiv = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

export const getInput = (id: string): HTMLInputElement =>
  getElement(id, HTMLInputElement, 'input')

export const getLabel = (id: string): HTMLLabelElement =>
  getElement(id, HTMLLabelElement, 'label')

export const getSelect = (id: string): HTMLSelectElement =>
  getElement(id, HTMLSelectElement, 'select')

export const createOption = (
  select: HTMLSelectElement,
  { id, label }: { id: string; label: string },
): void => {
  if (!select.querySelector(`option[value="${id}"]`)) {
    select.append(new Option(label, id))
  }
}

export const configureNumericInput = (
  input: HTMLInputElement,
  { max, min }: { max?: number; min?: number },
): void => {
  if (input.type === 'number') {
    input.setAttribute('inputmode', 'numeric')
    if (min !== undefined) {
      input.min = String(min)
    }
    if (max !== undefined) {
      input.max = String(max)
    }
  }
}
