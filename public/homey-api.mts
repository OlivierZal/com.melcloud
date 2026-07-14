import type HomeyWidget from 'homey/lib/HomeyWidget'

export interface Homey<
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends HomeyWidget {
  readonly getSettings: () => TSettings
}

declare global {
  // Resolved by the inline bootstrap each webview HTML registers at
  // parse time (see the <script> in the page head).
  var homeyReady: Promise<unknown>
}

// Give slow transports a real chance while keeping the loading overlay
// finite: past this point the page surfaces the failure instead.
const INIT_TIMEOUT_MS = 10_000

/**
 * The Homey SDK calls `onHomeyReady` on its own schedule — for widgets it
 * is injected by the host app at a time the page does not control, so the
 * handler must exist at HTML parse time, before this module has even been
 * fetched. Each webview HTML registers it inline and exposes the instance
 * through `window.homeyReady`; this is the module-side await.
 * @template THomey - Page-specific Homey shape (widget settings generic).
 * @returns The Homey instance handed to `onHomeyReady`.
 */
export const resolveHomey = async <THomey,>(): Promise<THomey> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the SDK hands an untyped instance to onHomeyReady; this is that same parse boundary
  (await globalThis.homeyReady) as THomey

/**
 * Bounds a webview init chain: `Homey.ready()` must always end the
 * loading overlay, so a hung transport call cannot be allowed to hold it
 * open forever. The underlying work is not cancelled — a late success
 * simply repaints over the error state.
 * @template T - Result type of the bounded work.
 * @param work - The init chain to bound.
 * @returns The work's result, or a rejection once the deadline passes.
 */
export const withInitTimeout = async <T,>(work: Promise<T>): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Timed out while loading data from the app'))
        }, INIT_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Surfaces an error in the widget dev tools without blocking the caller:
 * `reportError` where the webview provides it, an async rethrow otherwise.
 */
export const surfaceError = (error: unknown): void => {
  if (typeof reportError === 'function') {
    reportError(error)
    return
  }
  setTimeout(() => {
    throw error instanceof Error ? error : (
        new Error('Unhandled widget error', { cause: error })
      )
  }, 0)
}

/**
 * Runs an async operation that shouldn't block. Rejections go to `onError`
 * (default: `surfaceError`, which reports them in the widget dev tools).
 * Pass a homey.alert handler for user-visible failures, or a no-op when a
 * miss is acceptable.
 */
export const fireAndForget = (
  promise: Promise<unknown>,
  onError: (error: unknown) => void = surfaceError,
): void => {
  // eslint-disable-next-line unicorn/prefer-await -- fire-and-forget: rejections route to onError without blocking the caller
  promise.catch(onError)
}

export const homeyApiGet = async <T,>(
  homey: HomeyWidget,
  path: string,
): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey widget API returns unknown
  (await homey.api('GET', path)) as T

export const homeyApiPut = async (
  homey: HomeyWidget,
  path: string,
  body: object,
): Promise<void> => {
  await homey.api('PUT', path, body)
}

export const setDocumentLanguage = async (
  homey: HomeyWidget,
): Promise<void> => {
  document.documentElement.lang = await homeyApiGet<string>(homey, '/language')
}
