import { describe, expect, it } from 'vitest'

import { getWebviewHashes } from '../../lib/webview-hashes.mts'

const fixture = (name: string): URL =>
  new URL(`../fixtures/webview-hashes/${name}`, import.meta.url)

describe(getWebviewHashes, () => {
  it('should serve an empty map when no manifest is packaged', async () => {
    // The bare call reads next to the app root, where a dev suite run
    // has no manifest; the second call exercises the cache.
    await expect(getWebviewHashes()).resolves.toStrictEqual({})
    await expect(getWebviewHashes()).resolves.toStrictEqual({})
  })

  it('should serve the packaged manifest', async () => {
    await expect(
      getWebviewHashes(fixture('valid.json')),
    ).resolves.toStrictEqual({
      'ata-group-setting': 'aaaa1111',
      charts: 'cccc3333',
      settings: 'bbbb2222',
    })
  })

  it('should serve an empty map for a malformed manifest', async () => {
    await expect(
      getWebviewHashes(fixture('malformed.txt')),
    ).resolves.toStrictEqual({})
  })

  it('should serve an empty map for an off-shape manifest', async () => {
    await expect(
      getWebviewHashes(fixture('offshape.json')),
    ).resolves.toStrictEqual({})
  })
})
