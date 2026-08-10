// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import type * as Classic from '@olivierzal/melcloud-api/classic'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  appendFormControl,
  hideInitError,
  populateZoneOptions,
  showInitError,
  translateAriaLabels,
} from '../../public/dom.mts'
import { mock } from '../helpers.ts'

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

  describe('init error', () => {
    it('should show then hide the message element', () => {
      const element = document.createElement('p')
      element.id = 'init_error'
      element.hidden = true
      document.body.append(element)
      showInitError(new Error('boom'))

      expect(element.hidden).toBe(false)
      expect(element.textContent).toBe('boom')

      hideInitError()

      expect(element.hidden).toBe(true)
      expect(element.textContent).toBe('')
    })

    it('should tolerate a page without the element', () => {
      expect(() => {
        showInitError(new Error('boom'))
        hideInitError()
      }).not.toThrow()
    })
  })
})
