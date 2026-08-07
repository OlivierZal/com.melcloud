import type HomeyWidget from 'homey/lib/HomeyWidget'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { watchWidgetFreshness } from '../../public/webview-freshness-boot.mts'
import { mock } from '../helpers.ts'

// The wrapper feeds the transport-free twin primitive the widget
// transport, so the primitive's own suite covers the decision table;
// these tests pin the wiring — event name, re-run, fail-open poke.
const globals = globalThis as {
  document?: unknown
  location?: unknown
  sessionStorage?: unknown
}

const installFreshPage = (): void => {
  globals.document = {
    querySelectorAll: (): readonly {
      getAttribute: (name: string) => string | null
    }[] => [
      {
        getAttribute: (name: string): string | null =>
          name === 'src' ? 'index.js?v=aaaa1111' : null,
      },
    ],
  }
  globals.location = {
    href: 'https://webview.invalid/page',
    replace: vi.fn<(url: string) => void>(),
  }
  const store = new Map<string, string>()
  globals.sessionStorage = {
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value)
    },
  }
}

const flushMicrotasks = async (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0)
  })

describe(watchWidgetFreshness, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should subscribe to the app boot poke', async () => {
    const on = vi.fn<(event: string, callback: () => void) => void>()
    installFreshPage()

    await watchWidgetFreshness(mock<HomeyWidget>({ on }), 'ata-group-setting')

    expect(on).toHaveBeenCalledTimes(1)
    expect(on).toHaveBeenCalledWith(
      'webview_hashes_changed',
      expect.any(Function),
    )
  })

  it('should re-run the handshake when the poke fires', async () => {
    const api = vi
      .fn<(method: string, path: string) => Promise<unknown>>()
      .mockResolvedValue({ 'ata-group-setting': 'aaaa1111' })
    const on = vi.fn<(event: string, callback: () => void) => void>()
    installFreshPage()
    await watchWidgetFreshness(
      mock<HomeyWidget>({ api, on }),
      'ata-group-setting',
    )

    on.mock.calls[0]?.[1]()
    await flushMicrotasks()

    expect(api).toHaveBeenCalledWith('GET', '/webview-hashes')
  })

  it('should swallow a failing recheck', async () => {
    const api = vi
      .fn<(method: string, path: string) => Promise<unknown>>()
      .mockRejectedValue(new Error('bridge down'))
    const on = vi.fn<(event: string, callback: () => void) => void>()
    installFreshPage()
    await watchWidgetFreshness(
      mock<HomeyWidget>({ api, on }),
      'ata-group-setting',
    )

    expect(() => {
      on.mock.calls[0]?.[1]()
    }).not.toThrow()

    await flushMicrotasks()
  })
})

describe(`${watchWidgetFreshness.name} boot check`, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should resolve false on a fresh page without navigating', async () => {
    const api = vi
      .fn<(method: string, path: string) => Promise<unknown>>()
      .mockResolvedValue({ 'ata-group-setting': 'aaaa1111' })
    installFreshPage()

    await expect(
      watchWidgetFreshness(
        mock<HomeyWidget>({
          api,
          on: vi.fn<(event: string, callback: () => void) => void>(),
        }),
        'ata-group-setting',
      ),
    ).resolves.toBe(false)

    expect(api).toHaveBeenCalledWith('GET', '/webview-hashes')
  })
})
