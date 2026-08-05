// Self-heal for the phone webview cache. Pages and their bundles are
// cached across app versions — the HTML itself included (proven in the
// wild), so a booted page may run stale UI code indefinitely: the
// cached HTML's `?v=` stamps keep serving the matching cached assets.
// The page's identity is the DOCUMENT-ORDER join of every `?v=` stamp
// it carries (so a CSS-only or markup-only ship moves it too); the app
// serves the live identities (`GET /webview-hashes`, emitted at
// package time), fetched through the app bridge so no HTTP cache can
// stale them. On mismatch the page refetches itself ONCE, through an
// address the HTTP cache has never seen: a bare reload can be served
// the same stale document again (proven on-device by a page mixing
// asset generations), burning the one-shot guard on a no-op. A
// mismatch that survives its refetch is reported through the optional
// `report` channel instead of retried. Every failure path stays open
// (unstamped page, unreachable route, unknown entry, denied storage):
// a wrong guess must never take a working webview down. Byte-identical
// copies live in the sibling Homey apps — edit all three together.

const REFETCH_GUARD_KEY = 'webview_refetched_for'

const STAMP = /\?v=(?<hash>[0-9a-f]+)$/u

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

// Denied storage reads as "already refetched": without the guard a
// persistent mismatch would refetch forever, and never refetching is
// the safe side of that trade.
const hasRefetchedFor = (hash: string): boolean => {
  try {
    return sessionStorage.getItem(REFETCH_GUARD_KEY) === hash
  } catch {
    return true
  }
}

const markRefetchedFor = (hash: string): void => {
  try {
    sessionStorage.setItem(REFETCH_GUARD_KEY, hash)
  } catch {
    // Denied storage already reads as "refetched" (`hasRefetchedFor`).
  }
}

// The `fresh` key makes the address one the HTTP cache has never seen,
// forcing a network fetch of the document; it is overwritten, never
// accumulated, and carries the stale identity — not a clock or random
// read, which would mint a new address on every boot and sidestep the
// per-identity guard.
const refetchDocument = (identity: string): void => {
  const url = new URL(location.href)
  url.searchParams.set('fresh', identity)
  location.replace(url.href)
}

// One-shot refetch decision for a confirmed mismatch: refetches unless
// this identity already spent its attempt, reporting either way.
const refetchOnce = (
  identity: string,
  expected: string,
  report?: (message: string) => void,
): boolean => {
  if (hasRefetchedFor(identity)) {
    report?.(
      `Stale webview persists after its refetch: page ${identity}, live ${expected}`,
    )
    return false
  }
  report?.(`Stale webview: page ${identity}, live ${expected} — refetching`)
  markRefetchedFor(identity)
  refetchDocument(identity)
  return true
}

// Returns whether a refetch was issued — the caller must then skip its
// own init: the document is about to be replaced.
export const ensureFreshWebview = async (
  entry: string,
  fetchHashes: () => Promise<Partial<Record<string, string>>>,
  report?: (message: string) => void,
): Promise<boolean> => {
  const identity = getPageIdentity()
  if (identity === null) {
    return false
  }
  const expected = await fetchExpected(entry, fetchHashes)
  if (expected === undefined || expected === identity) {
    return false
  }
  return refetchOnce(identity, expected, report)
}
