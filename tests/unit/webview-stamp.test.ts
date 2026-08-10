import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  type WebviewPage,
  stampHtml,
  stampPackagedPages,
  stampReferences,
} from '../../scripts/webview-stamp.mts'

// One temp packaging tree per test, so a stamped page never leaks into
// the next; boxed because the hooks refill it.
const tree = { outRoot: '' }

const PAGES: readonly WebviewPage[] = [
  { entry: 'settings', page: 'settings/index.html' },
  { entry: 'charts', page: 'widgets/charts/public/index.html' },
]

const writePage = async (
  page: string,
  html: string,
  assets: Readonly<Record<string, string>> = {},
): Promise<string> => {
  const htmlPath = path.join(tree.outRoot, page)
  const directory = path.dirname(htmlPath)
  await mkdir(directory, { recursive: true })
  await writeFile(htmlPath, html)
  for (const [file, content] of Object.entries(assets)) {
    const assetPath = path.join(directory, file)
    // eslint-disable-next-line no-await-in-loop -- sequential by design: each asset's directory must exist before the next write
    await mkdir(path.dirname(assetPath), { recursive: true })
    // eslint-disable-next-line no-await-in-loop -- sequential by design: written in declaration order alongside its directory
    await writeFile(assetPath, content)
  }
  return htmlPath
}

const readPage = async (htmlPath: string): Promise<string> =>
  readFile(htmlPath, 'utf8')

const stampsOf = (html: string): string[] =>
  html
    .matchAll(/\?v=(?<hash>[0-9a-f]+)/gv)
    .map(({ groups }) => groups?.hash ?? '')
    .toArray()

describe('webview stamping', () => {
  beforeEach(async () => {
    tree.outRoot = await mkdtemp(path.join(tmpdir(), 'melcloud-stamp-'))
  })

  afterEach(async () => {
    await rm(tree.outRoot, { force: true, recursive: true })
  })

  it('should stamp every local reference with its content hash', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="index.css" rel="stylesheet"><script defer src="index.js"></script>',
      { 'index.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)
    const html = await readPage(htmlPath)
    const stamps = stampsOf(html)

    expect(stamps).toHaveLength(2)
    expect(identity).toBe(stamps.join('.'))
  })

  it('should join the identity over unique hashes, as the page does', async () => {
    // Two DIFFERENT files with identical bytes carry the same stamp: the
    // page joins a Set of stamp VALUES, so counting both here would mint
    // an identity no page could ever match — an endless refetch.
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="a.css" rel="stylesheet"><link href="b.css" rel="stylesheet"><script defer src="index.js"></script>',
      { 'a.css': 'body{}', 'b.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)
    const stamps = stampsOf(await readPage(htmlPath))

    // Three references, two distinct hashes.
    expect(stamps).toHaveLength(3)
    expect(identity).toBe([...new Set(stamps)].join('.'))
  })

  it('should move the identity when any asset changes', async () => {
    const html =
      '<link href="index.css" rel="stylesheet"><script defer src="index.js"></script>'
    const first = await writePage('settings/index.html', html, {
      'index.css': 'body{}',
      'index.js': 'console.log(1)',
    })
    const before = await stampHtml(first)
    const second = await writePage('widgets/charts/public/index.html', html, {
      // A CSS-only ship still moves the page identity.
      'index.css': 'body{color:red}',
      'index.js': 'console.log(1)',
    })

    const after = await stampHtml(second)

    expect(after).not.toBe(before)
  })

  it('should re-stamp a page that already carries stamps', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<script defer src="index.js?v=deadbeef"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)

    expect(stampsOf(await readPage(htmlPath))).not.toContain('deadbeef')
  })

  it('should stamp only inside a reference context', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<!-- index.js is the bundle --><script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)
    const html = await readPage(htmlPath)

    expect(html).toContain('<!-- index.js is the bundle -->')
    expect(stampsOf(html)).toHaveLength(1)
  })

  it('should stamp a tag Prettier exploded over several lines', async () => {
    // Prettier owns the page's shape and breaks a tag past the print
    // width into one attribute per line. A pattern scoped to a tag or to
    // a single line would still stamp the inline form and silently miss
    // this one, so both shapes share a page here.
    const htmlPath = await writePage(
      'settings/index.html',
      `<link href="index.css" rel="stylesheet" />
<script
  data-testid="a-tag-past-the-print-width-that-prettier-explodes"
  defer
  src="index.js"
></script>`,
      { 'index.css': 'body{}', 'index.js': 'console.log(1)' },
    )

    const identity = await stampHtml(htmlPath)

    expect(stampsOf(await readPage(htmlPath))).toHaveLength(2)
    expect(identity).not.toBeNull()
  })

  it('should leave remote and rooted references alone', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<link href="https://cdn.invalid/x.css" rel="stylesheet"><img src="/logo.png" alt=""><script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await stampHtml(htmlPath)
    const html = await readPage(htmlPath)

    expect(html).toContain('href="https://cdn.invalid/x.css"')
    expect(html).toContain('src="/logo.png"')
    expect(stampsOf(html)).toHaveLength(1)
  })

  it('should stamp an unknown file blank rather than drop it', () => {
    // A reference whose asset never hashed keeps its shape, so the page
    // still loads and its identity simply cannot match — the handshake's
    // fail-open side.
    expect(stampReferences('<script src="ghost.js"></script>', new Map())).toBe(
      '<script src="ghost.js?v="></script>',
    )
  })

  it('should report no identity for an unstamped page', async () => {
    const htmlPath = await writePage(
      'settings/index.html',
      '<p>Nothing to stamp</p>',
    )

    await expect(stampHtml(htmlPath)).resolves.toBeNull()
  })

  it('should report no identity for an absent page copy', async () => {
    await expect(
      stampHtml(path.join(tree.outRoot, 'settings/index.html')),
    ).resolves.toBeNull()
  })

  it('should emit the manifest once every page is stamped', async () => {
    for (const { page } of PAGES) {
      // eslint-disable-next-line no-await-in-loop -- sequential by design: one page tree written at a time
      await writePage(page, '<script defer src="index.js"></script>', {
        'index.js': `console.log('${page}')`,
      })
    }

    await expect(stampPackagedPages(tree.outRoot, PAGES)).resolves.toBe(true)

    const manifest: unknown = JSON.parse(
      await readFile(path.join(tree.outRoot, 'webview-hashes.json'), 'utf8'),
    )

    expect(Object.keys(manifest as object)).toStrictEqual([
      'settings',
      'charts',
    ])
  })

  it('should write no partial manifest outside the CLI flow', async () => {
    // Only one page copy exists: a standalone suite run stamps nothing
    // and must not leave a half-filled manifest behind.
    await writePage(
      PAGES[0]?.page ?? '',
      '<script defer src="index.js"></script>',
      { 'index.js': 'console.log(1)' },
    )

    await expect(stampPackagedPages(tree.outRoot, PAGES)).resolves.toBe(false)
    await expect(
      readFile(path.join(tree.outRoot, 'webview-hashes.json'), 'utf8'),
    ).rejects.toThrow('ENOENT')
  })
})
