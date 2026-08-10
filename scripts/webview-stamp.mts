// Cache-busting for the PACKAGED pages: phone webviews cache assets
// across app versions, so a content hash per file (`?v=`) forces a
// refetch exactly when a file changes, and the join of a page's stamps
// is the identity its own freshness handshake compares against
// (`GET /webview-hashes`). The committed source HTML stays unstamped —
// this is a package-time transform of the `.homeybuild` copy, which
// exists in the CLI flow (its pre-process copy runs before
// `npm run build`) and is absent in a standalone suite run, which only
// proves the bundles compile.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const HASH_LENGTH = 8

// A local asset reference — an href/src attribute value, with an
// optional existing stamp.
const REFERENCE =
  /(?<prefix>href="|src=")(?<file>[^"':?\/][^"':?]*)(?:\?v=[0-9a-f]+)?(?<suffix>")/gv

// A reference's parts, exactly as the pattern captures them.
interface Reference {
  readonly file: string
  readonly prefix: string
  readonly suffix: string
}

/**
 * One packaged page and the manifest key its bundle hash is served
 * under.
 */
export interface WebviewPage {
  readonly entry: string
  readonly page: string
}

const hashOf = async (filePath: string): Promise<string> => {
  const content = await readFile(filePath)
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, HASH_LENGTH)
}

// One parse for both passes, reading the captures POSITIONALLY: a
// replacer's parameters are plain strings the pattern always fills,
// where `matchAll` hands back `groups` typed as possibly-absent and so
// demands fallbacks no input can ever reach.
const rewriteReferences = (
  html: string,
  rewrite: (reference: Reference) => string,
): string =>
  html.replaceAll(REFERENCE, (...captures: string[]): string => {
    // The platform hands the replacer the whole match followed by each
    // capture; the pattern guarantees all three.
    const [, prefix = '', file = '', suffix = ''] = captures
    return rewrite({ file, prefix, suffix })
  })

const collectFiles = (html: string): ReadonlySet<string> => {
  const files = new Set<string>()
  rewriteReferences(html, ({ file, prefix, suffix }) => {
    files.add(file)
    return `${prefix}${file}${suffix}`
  })
  return files
}

const collectHashes = async (
  html: string,
  directory: string,
): Promise<ReadonlyMap<string, string>> =>
  new Map(
    await Promise.all(
      [...collectFiles(html)].map(async (file): Promise<[string, string]> => [
        file,
        await hashOf(path.join(directory, file)),
      ]),
    ),
  )

/**
 * Stamps only within a reference context, so the same filename written
 * elsewhere (e.g. a comment) is never rewritten.
 * @param html - The page to rewrite.
 * @param hashes - Content hash per referenced file.
 * @returns The page with every local reference stamped.
 */
export const stampReferences = (
  html: string,
  hashes: ReadonlyMap<string, string>,
): string =>
  rewriteReferences(
    html,
    ({ file, prefix, suffix }) =>
      `${prefix}${file}?v=${hashes.get(file) ?? ''}${suffix}`,
  )

/**
 * Stamps one packaged page in place and returns the identity it now
 * carries.
 * @param htmlPath - The packaged page copy.
 * @returns The page identity, or `null` when there is nothing to stamp.
 */
export const stampHtml = async (htmlPath: string): Promise<string | null> => {
  let html: string
  try {
    html = await readFile(htmlPath, 'utf8')
  } catch {
    // The page copy only exists in the CLI flow; a standalone suite run
    // has nothing to stamp.
    return null
  }
  const hashes = await collectHashes(html, path.dirname(htmlPath))
  const stamped = stampReferences(html, hashes)
  if (stamped !== html) {
    await writeFile(htmlPath, stamped)
  }
  // The page's identity is the join of every stamp it carries, in
  // DOCUMENT order (the match order of `REFERENCE`, which the page's
  // own collection mirrors): a change to any packaged asset (bundle,
  // stylesheet) moves the identity, so CSS-only or markup-only ships
  // self-heal too. Deduplicated by HASH, exactly as the page does it
  // (the kit's `webview-freshness` joins a `Set` of stamp VALUES): two
  // assets with identical bytes carry one stamp on the page, so
  // counting them twice here would mint an identity no page can ever
  // match — an endless refetch handshake.
  const identity = [...new Set(hashes.values())].join('.')
  return identity === '' ? null : identity
}

/**
 * Stamps every packaged page and emits the live-hash manifest the app
 * serves (`GET /webview-hashes`) — only in the CLI flow, where every
 * page copy exists: a standalone suite run stamps nothing and must not
 * leave a partial manifest.
 * @param outRoot - The packaging target directory.
 * @param pages - The packaged pages and their manifest keys.
 * @returns Whether the manifest was written.
 */
export const stampPackagedPages = async (
  outRoot: string,
  pages: readonly WebviewPage[],
): Promise<boolean> => {
  const stampedEntries = await Promise.all(
    pages.map(async ({ entry, page }): Promise<[string, string | null]> => [
      entry,
      await stampHtml(path.join(outRoot, page)),
    ]),
  )
  if (stampedEntries.some(([, hash]) => hash === null)) {
    return false
  }
  await writeFile(
    path.join(outRoot, 'webview-hashes.json'),
    JSON.stringify(Object.fromEntries(stampedEntries)),
  )
  return true
}
