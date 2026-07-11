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

export const getDiv = (id: string): HTMLDivElement =>
  getElement(id, HTMLDivElement, 'div')

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
