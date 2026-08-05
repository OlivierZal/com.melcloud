import { afterEach, describe, expect, it, vi } from 'vitest'

import { ensureFreshWebview } from '../../public/webview-freshness.mts'

// The helper reads narrow slices of the page (its stamped references,
// sessionStorage, location.reload), so plain doubles installed on
// globalThis are enough — no DOM environment.
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

const install = ({
  isStorageDenied = false,
  isWriteDenied = false,
  references,
  stored = null,
}: {
  references: readonly FakeReference[]
  isStorageDenied?: boolean
  isWriteDenied?: boolean
  stored?: string | null
}): { store: Map<string, string>; reload: () => void } => {
  const reload = vi.fn<() => void>()
  const store = new Map<string, string>()
  if (stored !== null) {
    store.set('webview_reloaded_for', stored)
  }
  globals.document = {
    querySelectorAll: (): readonly FakeReference[] => references,
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

  it('should reload once on a stale identity and record the guard', async () => {
    const { reload, store } = install({ references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.get('webview_reloaded_for')).toBe('cccc0000.00000000')
  })

  it('should not reload when the page identity is live', async () => {
    const { reload } = install({ references: FRESH_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should not reload twice for the same stale identity', async () => {
    const { reload } = install({
      references: STALE_PAGE,
      stored: 'cccc0000.00000000',
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put on an unstamped page', async () => {
    const { reload } = install({ references: [] })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should ignore references whose stamp is off-shape', async () => {
    const { reload } = install({
      references: [new FakeReference('src', 'index.js?v=NOT-A-HASH')],
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put when its entry is not served', async () => {
    const { reload } = install({ references: STALE_PAGE })

    await expect(ensureFreshWebview('charts', serveHashes)).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })

  it('should stay put when fetching the hashes fails', async () => {
    const { reload } = install({ references: STALE_PAGE })

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
    const { reload } = install({ isWriteDenied: true, references: STALE_PAGE })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(true)

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('should read denied storage as already reloaded', async () => {
    const { reload } = install({
      isStorageDenied: true,
      references: STALE_PAGE,
    })

    await expect(
      ensureFreshWebview('ata-group-setting', serveHashes),
    ).resolves.toBe(false)

    expect(reload).not.toHaveBeenCalled()
  })
})
