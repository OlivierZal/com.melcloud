import { getWebviewHashes as readWebviewHashes } from '@olivierzal/homey-kit/node'

// Where the bundler stamped the manifest is APP knowledge, and the only
// piece the kit cannot supply: its own default resolves against its
// module inside `node_modules`. Bound once here so no surface repeats
// it — dropping it would silently disable the freshness handshake, the
// reader failing open with an empty map.
const MANIFEST_URL = new URL('../webview-hashes.json', import.meta.url)

/**
 * Reads the packaged webview-hash manifest of this app.
 * @returns The bundle hash per page entry; empty outside the packaged flow.
 */
export const getWebviewHashes = async (): Promise<
  Partial<Record<string, string>>
> => readWebviewHashes(MANIFEST_URL)
