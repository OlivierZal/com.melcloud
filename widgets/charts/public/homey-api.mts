import type HomeyWidget from 'homey/lib/HomeyWidget'

export interface Homey<
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends HomeyWidget {
  readonly getSettings: () => TSettings
}

const defaultOnError = (error: unknown): void => {
  // eslint-disable-next-line no-console -- intentional fallback: surfaces otherwise-swallowed rejections in widget dev tools
  console.error(error)
}

/**
 * Runs an async operation that shouldn't block. Rejections go to `onError`
 * (default: console.error). Pass a homey.alert handler for user-visible
 * failures, or a no-op when a miss is acceptable.
 */
export const fireAndForget = (
  promise: Promise<unknown>,
  onError: (error: unknown) => void = defaultOnError,
): void => {
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
