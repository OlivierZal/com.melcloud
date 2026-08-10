import { getErrorMessage } from '@olivierzal/homey-kit'
import {
  type HTMLValueElement,
  createLabel,
  createOption,
} from '@olivierzal/homey-kit/dom'

import {
  type PickerZone,
  getSubzones,
  getZoneId,
  getZoneName,
} from './zones.mts'

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
