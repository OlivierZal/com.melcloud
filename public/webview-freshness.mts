// Self-heal for the phone webview cache. Pages and their bundles are
// cached across app versions — the HTML itself included (proven in the
// wild), so a booted page may run stale UI code indefinitely: the
// cached HTML's `?v=` keeps serving the matching cached bundle. The
// page's identity is that `?v=` content hash; the app serves the live
// hashes (`GET /webview-hashes`, emitted at package time), fetched
// through the app bridge so no HTTP cache can stale them. On mismatch
// the page reloads ONCE — the reload revalidates the HTML, whose fresh
// `?v=` pulls the fresh bundle. Every failure path stays open
// (unstamped page, unreachable route, unknown entry, denied storage):
// a wrong guess must never take a working webview down. Byte-identical
// copies live in the sibling Homey apps — edit all three together.

const RELOAD_GUARD_KEY = 'webview_reloaded_for'

const fetchHashesSafely = async (
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
): Promise<Partial<Record<string, string>>> => {
  try {
    return await fetchHashes()
  } catch {
    return {}
  }
}

const fetchExpected = async (
  entry: string,
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
): Promise<string | undefined> => {
  const hashes = await fetchHashesSafely(fetchHashes)
  return hashes[entry]
}

const getOwnHash = (): string | null => {
  const script = document.querySelector('script[src*="index.js"]')
  if (!(script instanceof HTMLScriptElement)) {
    return null
  }
  const bundleUrl = new URL(script.src)
  return bundleUrl.searchParams.get('v')
}

// Denied storage reads as "already reloaded": without the guard a
// persistent mismatch would reload forever, and never reloading is the
// safe side of that trade.
const hasReloadedFor = (hash: string): boolean => {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) === hash
  } catch {
    return true
  }
}

const markReloadedFor = (hash: string): void => {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, hash)
  } catch {
    // Denied storage already reads as "reloaded" (`hasReloadedFor`).
  }
}

// Returns whether a reload was issued — the caller must then skip its
// own init: the document is about to be replaced.
export const ensureFreshWebview = async (
  entry: string,
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
): Promise<boolean> => {
  const hash = getOwnHash()
  if (hash === null) {
    return false
  }
  const expected = await fetchExpected(entry, fetchHashes)
  if (expected === undefined || expected === hash || hasReloadedFor(hash)) {
    return false
  }
  markReloadedFor(hash)
  location.reload()
  return true
}
