import type HomeyWidget from 'homey/lib/HomeyWidget'

export interface Homey<
  S extends Record<string, unknown> = Record<string, unknown>,
> extends HomeyWidget {
  readonly getSettings: () => S
}

export const homeyApiGet = async <T,>(
  homey: HomeyWidget,
  path: string,
): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
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
