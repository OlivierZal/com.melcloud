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

// Guarded assignment: writing a value with no matching option would reset
// the select to an empty selection. Membership is read off the options,
// never through a built selector, which a quote in the value would break.
export const applySelectValue = (
  select: HTMLSelectElement,
  value: string,
): void => {
  if ([...select.options].some((option) => option.value === value)) {
    select.value = value
  }
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

// An error line is optional: a page without it keeps working.
const findErrorLine = (id: string): HTMLElement | null => {
  const element = document.querySelector(`#${CSS.escape(id)}`)
  return element instanceof HTMLElement ? element : null
}

/**
 * Clears a static error line: the init failure once the init work
 * completes, so a load that outlives its timeout removes the degraded
 * state once it eventually succeeds; a write failure once a write lands
 * or its zone is left.
 * @param id - The line's element id, without `#`.
 * @returns Whether the line was showing, so a widget resizes only when
 * its content actually shrank.
 */
export const hideErrorLine = (id: string): boolean => {
  const element = findErrorLine(id)
  // `hidden` also reads 'until-found', which hides the line too.
  if (element?.hidden !== false) {
    return false
  }

  element.hidden = true
  element.textContent = ''
  return true
}

/**
 * Reveals a static error line with the failure message, so the user sees
 * why instead of nothing: an init failure once the overlay ends
 * (`ready()` fires in the caller's `finally`) rather than an endless
 * overlay, a write the app refused rather than an Update that silently
 * stays armed.
 * @param id - The line's element id, without `#`.
 * @param error - The failure to display.
 */
export const showErrorLine = (id: string, error: unknown): void => {
  const element = findErrorLine(id)
  if (element === null) {
    return
  }

  element.textContent = getErrorMessage(error)
  element.hidden = false
}
