import type HomeyWidget from 'homey/lib/HomeyWidget'

/**
 * The widget SDK instance, with the settings this app stores on its
 * widgets. Module augmentation cannot be packaged, so the tie to the SDK
 * type stays here.
 * @template TSettings - The widget's stored settings shape.
 */
export interface Homey<
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends HomeyWidget {
  readonly getSettings: () => TSettings
}

// Promise-native transport over the widget SDK, the counterpart of the
// kit's `./settings` for the callback-based settings SDK. It belongs in
// the kit and is written there, but `WidgetApi` types its `method` as
// `string` where the SDK narrows it to four literals: parameters are
// contravariant, so the real widget is not assignable to it. Kept here
// until the kit narrows that member.

/**
 * Reads an app-API route.
 * @template T - The route's response shape.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @returns The route's response.
 */
export const homeyApiGet = async <T,>(
  homey: HomeyWidget,
  path: string,
): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Homey widget API returns unknown
  (await homey.api('GET', path)) as T

/**
 * Posts to an app-API route.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @param body - The request body.
 */
export const homeyApiPost = async (
  homey: HomeyWidget,
  path: string,
  body: object,
): Promise<void> => {
  await homey.api('POST', path, body)
}

/**
 * Puts to an app-API route.
 * @param homey - The widget SDK instance.
 * @param path - The app-API path.
 * @param body - The request body.
 */
export const homeyApiPut = async (
  homey: HomeyWidget,
  path: string,
  body: object,
): Promise<void> => {
  await homey.api('PUT', path, body)
}
