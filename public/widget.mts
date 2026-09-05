import type HomeyWidget from 'homey/lib/HomeyWidget'

/**
 * The widget SDK instance, with the settings this app stores on its
 * widgets. Module augmentation cannot be packaged, so the tie to the SDK
 * type stays here; the promise-native transport over it is the kit's
 * (`@olivierzal/homey-kit/widget`).
 * @template TSettings - The widget's stored settings shape.
 */
export interface Homey<
  TSettings extends Record<string, unknown> = Record<string, unknown>,
> extends HomeyWidget {
  readonly getSettings: () => TSettings
}
