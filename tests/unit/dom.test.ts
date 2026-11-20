// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableJavaScriptFileLoading": true, "handleDisabledFileLoadingAsSuccess": true, "navigation": {"disableMainFrameNavigation": true}}}

import type * as Classic from '@olivierzal/melcloud-api/classic'
import { mock } from '@olivierzal/homey-kit/testing'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  appendFormControl,
  applySelectValue,
  hideErrorLine,
  populateZoneOptions,
  showErrorLine,
  translateAriaLabels,
} from '../../public/dom.mts'

const selectOf = (...values: string[]): HTMLSelectElement => {
  const select = document.createElement('select')
  for (const value of values) {
    const option = document.createElement('option')
    option.value = value
    select.append(option)
  }
  document.body.append(select)
  return select
}

const appendLine = (id: string): HTMLParagraphElement => {
  const element = document.createElement('p')
  element.id = id
  element.hidden = true
  document.body.append(element)
  return element
}

describe('webview dom helpers', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  describe(appendFormControl, () => {
    it('should append a labelled control', () => {
      const parent = document.createElement('div')
      const formControl = document.createElement('input')
      formControl.id = 'field'
      appendFormControl(parent, { formControl, title: 'Field' })
      const label = parent.querySelector('label')

      expect(label?.htmlFor).toBe('field')
      expect(label?.textContent).toBe('Field')
    })

    it('should skip a null control', () => {
      const parent = document.createElement('div')
      appendFormControl(parent, { formControl: null, title: 'Absent' })

      expect(parent.childElementCount).toBe(0)
    })
  })

  describe(applySelectValue, () => {
    it('should select a value that has an option', () => {
      const select = selectOf('a', 'b"c')

      expect(applySelectValue(select, 'b"c')).toBe(true)
      expect(select.value).toBe('b"c')
    })

    it('should keep the selection for a value without an option', () => {
      const select = selectOf('a', 'b')
      select.value = 'b'

      expect(applySelectValue(select, 'missing')).toBe(false)
      expect(select.value).toBe('b')
    })
  })

  describe(populateZoneOptions, () => {
    it('should walk the classic tree in list order', () => {
      const select = document.createElement('select')
      document.body.append(select)
      const zones = [
        mock<Classic.BuildingZone>({
          areas: [],
          devices: [{ id: 11, level: 1, model: 'devices', name: 'Living' }],
          floors: [
            {
              areas: [{ id: 31, level: 2, model: 'areas', name: 'Corner' }],
              devices: [],
              id: 21,
              level: 1,
              model: 'floors',
              name: 'Upstairs',
            },
          ],
          id: 1,
          level: 0,
          model: 'buildings',
          name: 'Home',
        }),
      ]
      populateZoneOptions(select, zones)

      expect(
        [...select.options].map(({ textContent, value }) => ({
          label: textContent,
          value,
        })),
      ).toStrictEqual([
        { label: ' Home', value: 'buildings_1' },
        { label: '··· Living', value: 'devices_11' },
        { label: '··· Upstairs', value: 'floors_21' },
        { label: '······ Corner', value: 'areas_31' },
      ])
    })
  })

  describe(translateAriaLabels, () => {
    it('should translate marked elements and skip empty markers', () => {
      const marked = document.createElement('span')
      marked.dataset.i18nAriaLabel = 'widgets.zones'
      const empty = document.createElement('span')
      empty.dataset.i18nAriaLabel = ''
      empty.ariaLabel = 'untouched'
      document.body.append(marked, empty)
      translateAriaLabels((key) => `translated:${key}`)

      expect(marked.ariaLabel).toBe('translated:widgets.zones')
      expect(empty.ariaLabel).toBe('untouched')
    })
  })

  describe('error lines', () => {
    it('should show then hide the line its id names', () => {
      const element = appendLine('update_error')
      const other = appendLine('init_error')
      showErrorLine('update_error', new Error('boom'))

      expect(element.hidden).toBe(false)
      expect(element.textContent).toBe('boom')
      expect(other.hidden).toBe(true)
      expect(hideErrorLine('update_error')).toBe(true)
      expect(element.hidden).toBe(true)
      expect(element.textContent).toBe('')
      // Nothing was showing any more, so nothing shrank.
      expect(hideErrorLine('update_error')).toBe(false)
    })

    it('should find a line whose id needs escaping', () => {
      const element = appendLine('error:line')
      showErrorLine('error:line', 'boom')

      expect(element.textContent).toBe('boom')
    })

    it('should tolerate a page without the line', () => {
      expect(() => {
        showErrorLine('init_error', new Error('boom'))
      }).not.toThrow()
      expect(hideErrorLine('init_error')).toBe(false)
    })
  })
})
