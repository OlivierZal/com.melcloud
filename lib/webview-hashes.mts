// The live webview-bundle hashes, emitted by `scripts/bundle.mts` into
// the packaged app at stamping time: `GET /webview-hashes` serves them
// so a booted page can compare its own `?v=` and reload itself once
// when the phone webview cache served a stale copy. Outside the
// packaged flow (dev suite runs) the manifest is absent — an empty map,
// and every page treats itself as fresh. Byte-identical copies live in
// the sibling Homey apps — edit all three together.
import { readFile } from 'node:fs/promises'

const isStringRecord = (
  value: unknown,
): value is Partial<Record<string, string>> =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((entry) => typeof entry === 'string')

const parseManifest = (content: string): unknown => {
  try {
    return JSON.parse(content)
  } catch {
    return null
  }
}

const readManifest = async (manifestUrl: URL): Promise<string | null> => {
  try {
    return await readFile(manifestUrl, 'utf8')
  } catch {
    return null
  }
}

const loadWebviewHashes = async (
  manifestUrl: URL,
): Promise<Partial<Record<string, string>>> => {
  const content = await readManifest(manifestUrl)
  if (content === null) {
    return {}
  }
  const parsed = parseManifest(content)
  return isStringRecord(parsed) ? parsed : {}
}

const cache: { value: Promise<Partial<Record<string, string>>> | null } = {
  value: null,
}

// The optional URL is the test seam; the bare call the route handler
// makes reads (and caches) the packaged manifest next to the app root.
export const getWebviewHashes = async (
  manifestUrl?: URL,
): Promise<Partial<Record<string, string>>> => {
  if (manifestUrl !== undefined) {
    return loadWebviewHashes(manifestUrl)
  }
  cache.value ??= loadWebviewHashes(
    new URL('../webview-hashes.json', import.meta.url),
  )
  return cache.value
}
