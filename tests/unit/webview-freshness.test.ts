import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureFreshWebview } from '../../public/webview-freshness.mts'

// The helper reads narrow slices of the page (its own script tag,
// sessionStorage, location.reload), so plain doubles installed on
// globalThis are enough — no DOM environment.
class FakeScriptElement {
  public src = ''
}

const globals = globalThis as {
  document?: unknown
  HTMLScriptElement?: unknown
  location?: unknown
  sessionStorage?: unknown
}

const install = ({
  isStorageDenied = false,
  isWriteDenied = false,
  src,
  stored = null,
}: {
  src: string | null
  isStorageDenied?: boolean
  isWriteDenied?: boolean
  stored?: string | null
}): { store: Map<string, string>; reload: () => void } => {
  const reload = vi.fn<() => void>()
  const store = new Map<string, string>()
  if (stored !== null) {
    store.set('webview_reloaded_for', stored)
  }
  const script = new FakeScriptElement()
  if (src !== null) {
    script.src = src
  }
  globals.HTMLScriptElement = FakeScriptElement
  globals.document = {
    querySelector: (): FakeScriptElement | null =>
      src === null ? null : script,
  }
  globals.location = { reload }
  globals.sessionStorage = {
    getItem: (key: string): string | null => {
      if (isStorageDenied) {
        throw new Error('denied')
      }
      return store.get(key) ?? null
    },
    setItem: (key: string, value: string): void => {
      if (isStorageDenied || isWriteDenied) {
        throw new Error('denied')
      }
      store.set(key, value)
    },
  }
  return { reload, store }
}

const HASHES = { 'ata-group-setting': 'aaaa1111', settings: 'bbbb2222' }
const serveHashes = vi
  .fn<() => Promise<Partial<Record<string, string>>>>()
  .mockResolvedValue(HASHES)
const STALE_SRC = 'https://homey.local/widget/index.js?v=00000000'
const FRESH_SRC = 'https://homey.local/widget/index.js?v=aaaa1111'

describe(ensureFreshWebview, () => {
  afterEach(() => {
    delete globals.HTMLScriptElement
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should reload once on a stale hash and record the guard', async () => {
    const { reload, store } = install({ src: STALE_SRC })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get('webview_reloaded_for')).toBe('00000000')
  })

  it('should not reload when the page hash is live', async () => {
    const { reload } = install({ src: FRESH_SRC })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should not reload twice for the same stale hash', async () => {
    const { reload } = install({ src: STALE_SRC, stored: '00000000' })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put on an unstamped page', async () => {
    const { reload } = install({ src: 'https://homey.local/widget/index.js' })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put when the page has no bundle script', async () => {
    const { reload } = install({ src: null })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put when its entry is not served', async () => {
    const { reload } = install({ src: STALE_SRC })

    await expect(ensureFreshWebview('charts', serveHashes)).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put when fetching the hashes fails', async () => {
    const { reload } = install({ src: STALE_SRC })

    await expect(
      ensureFreshWebview(
        'ata-group-setting',
        vi
          .fn<() => Promise<Partial<Record<string, string>>>>()
          .mockRejectedValue(new Error('route absent')),
      ),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should reload even when the guard cannot be written', async () => {
    const { reload } = install({ isWriteDenied: true, src: STALE_SRC })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('should read denied storage as already reloaded', async () => {
    const { reload } = install({ isStorageDenied: true, src: STALE_SRC })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })
})
