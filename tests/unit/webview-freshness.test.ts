import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureFreshWebview } from '../../public/webview-freshness.mts'

// The helper reads narrow slices of the page (its stamped references,
// sessionStorage, location), so plain doubles installed on globalThis
// are enough — no DOM environment.
class FakeReference {
  readonly #reference: string

  readonly #slot: 'href' | 'src'

  public constructor(slot: 'href' | 'src', reference: string) {
    this.#reference = reference
    this.#slot = slot
  }

  public getAttribute(name: string): string | null {
    return name === this.#slot ? this.#reference : null
  }
}

const globals = globalThis as {
  document?: unknown
  location?: unknown
  sessionStorage?: unknown
}

const PAGE_URL = 'https://webview.invalid/page'

const install = ({
  href = PAGE_URL,
  isStorageDenied = false,
  isWriteDenied = false,
  references,
  stored = null,
}: {
  references: readonly FakeReference[]
  href?: string
  isStorageDenied?: boolean
  isWriteDenied?: boolean
  stored?: string | null
}): { store: Map<string, string>; replace: (url: string) => void } => {
  const replace = vi.fn<(url: string) => void>()
  const store = new Map<string, string>()
  if (stored !== null) {
    store.set('webview_refetched_for', stored)
  }
  globals.document = {
    querySelectorAll: (): readonly FakeReference[] => references,
  }
  globals.location = { href, replace }
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
  return { replace, store }
}

// The live identity is the DOCUMENT-ORDER join of the page's stamps.
const HASHES = {
  'ata-group-setting': 'cccc0000.aaaa1111',
  settings: 'bbbb2222',
}
const serveHashes = vi
  .fn<() => Promise<Partial<Record<string, string>>>>()
  .mockResolvedValue(HASHES)
const STALE_PAGE = [
  new FakeReference('href', 'styles/layout.css?v=cccc0000'),
  new FakeReference('src', 'index.js?v=00000000'),
]
const FRESH_PAGE = [
  new FakeReference('href', 'styles/layout.css?v=cccc0000'),
  new FakeReference('src', 'index.js?v=aaaa1111'),
]

describe(ensureFreshWebview, () => {
  afterEach(() => {
    delete globals.document
    delete globals.location
    delete globals.sessionStorage
  })

  it('should refetch a stale page through a never-cached address', async () => {
    const { replace, store } = install({ references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    // A fresh query key forces a network fetch — a bare reload can be
    // served the same stale document from the HTTP cache.
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=cccc0000.00000000`)
    expect(store.get('webview_refetched_for')).toBe('cccc0000.00000000')
  })

  it('should overwrite a previous fresh key instead of accumulating', async () => {
    const { replace } = install({
      href: `${PAGE_URL}?fresh=deadbeef`,
      references: STALE_PAGE,
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(replace).toHaveBeenCalledWith(`${PAGE_URL}?fresh=cccc0000.00000000`)
  })

  it('should report the identities alongside the refetch', async () => {
    const report = vi.fn<(message: string) => void>()
    install({ references: STALE_PAGE })

    await ensureFreshWebview('ata-group-setting', serveHashes, report)

    expect(report).toHaveBeenCalledWith(
      'Stale webview: page cccc0000.00000000, live cccc0000.aaaa1111 — refetching',
    )
  })

  it('should not refetch when the page identity is live', async () => {
    const { replace } = install({ references: FRESH_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should not refetch twice for the same stale identity', async () => {
    const { replace } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should report a mismatch that survived its refetch', async () => {
    const report = vi.fn<(message: string) => void>()
    const { replace } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes, report),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledWith(
      'Stale webview persists after its refetch: page cccc0000.00000000, live cccc0000.aaaa1111',
    )
  })

  it('should stay put on an unstamped page', async () => {
    const { replace } = install({ references: [] })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should ignore references whose stamp is off-shape', async () => {
    const { replace } = install({
      references: [new FakeReference('src', 'index.js?v=NOT-A-HASH')],
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should stay put when its entry is not served', async () => {
    const { replace } = install({ references: STALE_PAGE })

    await expect(ensureFreshWebview('charts', serveHashes)).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should stay put when fetching the hashes fails', async () => {
    const { replace } = install({ references: STALE_PAGE })

    await expect(
      ensureFreshWebview(
        'ata-group-setting',
        vi
          .fn<() => Promise<Partial<Record<string, string>>>>()
          .mockRejectedValue(new Error('route absent')),
      ),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })

  it('should refetch even when the guard cannot be written', async () => {
    const { replace } = install({ isWriteDenied: true, references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(replace).toHaveBeenCalledTimes(1)
  })

  it('should read denied storage as already refetched', async () => {
    const { replace } = install({
      isStorageDenied: true,
      references: STALE_PAGE,
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(replace).not.toHaveBeenCalled()
  })
})
