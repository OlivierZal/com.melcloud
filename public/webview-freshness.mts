// Self-heal for the phone webview cache. Pages and their bundles are
// cached across app versions — the HTML itself included (proven in the
// wild), so a booted page may run stale UI code indefinitely: the
// cached HTML's `?v=` stamps keep serving the matching cached assets.
// The page's identity is the SORTED JOIN of every `?v=` stamp it
// carries (so a CSS-only or markup-only ship moves it too); the app
// serves the live identities (`GET /webview-hashes`, emitted at
// package time), fetched through the app bridge so no HTTP cache can
// stale them. On mismatch the page reloads ONCE — the reload
// revalidates the HTML, whose fresh stamps pull the fresh assets.
// Every failure path stays open (unstamped page, unreachable route,
// unknown entry, denied storage): a wrong guess must never take a
// working webview down. Byte-identical copies live in the sibling
// Homey apps — edit all three together.

const RELOAD_GUARD_KEY = 'webview_reloaded_for'

const STAMP = /\?v=(?<hash>[0-9a-f]+)$/v

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

const getPageIdentity = (): string | null => {
  // Joined in DOCUMENT order — the stamping side iterates the same
  // HTML in source order, so the two joins agree with no comparator
  // (and no locale hazard); the Set drops a hypothetical duplicate
  // reference the stamping side would also collapse.
  const stamps = [
    ...new Set(
      [...document.querySelectorAll('[href*="?v="], [src*="?v="]')].flatMap(
        (element) => {
          const reference =
            element.getAttribute('href') ?? element.getAttribute('src') ?? ''
          const hash = STAMP.exec(reference)?.groups?.hash
          return hash === undefined ? [] : [hash]
        },
      ),
    ),
  ]
  return stamps.length > 0 ? stamps.join('.') : null
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
  const identity = getPageIdentity()
  if (identity === null) {
    return false
  }
  const expected = await fetchExpected(entry, fetchHashes)
  if (
    expected === undefined ||
    expected === identity ||
    hasReloadedFor(identity)
  ) {
    return false
  }
  markReloadedFor(identity)
  location.reload()
  return true
}
