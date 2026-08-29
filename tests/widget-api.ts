import type { Homey } from 'homey/lib/Homey'
import { describe, expect, it, vi } from 'vitest'

import { mock } from './helpers.ts'

interface WidgetApiHarness {
  readonly homey: Homey
  readonly mockI18n: { readonly getLanguage: ReturnType<typeof vi.fn> }
}

// Every widget api reaches its handlers through the same pair: the app
// instance under test and Homey's i18n manager.
export const createWidgetApiHarness = (mockApp: object): WidgetApiHarness => {
  const mockI18n = { getLanguage: vi.fn<() => string>() }
  return { homey: mock<Homey>({ app: mockApp, i18n: mockI18n }), mockI18n }
}

// The boot beacon is one contract across the widget surfaces: whatever
// body the page posts reaches app.error. `logBoot` stays a thunk so each
// suite keeps calling its OWN api with its own types.
export const describeWebviewBootLogging = (
  logBoot: () => void,
  mockError: ReturnType<typeof vi.fn>,
): void => {
  describe('webview boot logging', () => {
    it('should log the boot failure body via app.error', () => {
      logBoot()

      expect(mockError).toHaveBeenCalledTimes(1)
    })
  })
}
