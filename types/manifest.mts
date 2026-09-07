import type {
  LoginSetting as KitLoginSetting,
  ManifestDriver as KitManifestDriver,
  LocalizedStrings,
  PairSetting,
} from '@olivierzal/homey-kit/manifest'

import type { CapabilitiesOptionsValues } from './bases.mts'

// The kit's login step, narrowed to the fields this app's login form
// actually declares (the kit types the options as an open record).
interface LoginSetting extends KitLoginSetting {
  readonly options: {
    readonly passwordLabel: LocalizedStrings
    readonly usernameLabel: LocalizedStrings
    readonly usernamePlaceholder: string
    // A password has no format to illustrate and the label already names the
    // field, so it carries no placeholder. The username placeholder is a
    // single neutral ASCII example (an email is ASCII), not per-locale
    // strings — the labels hold the localization.
    readonly passwordPlaceholder?: string
  }
}

export interface Manifest {
  readonly drivers: readonly ManifestDriver[]
  readonly flow: ManifestFlow
  readonly version: string
}

// The kit's driver shape (id, name, pair, settings) plus what this
// app reads on top of it; `pair` narrows to the login step above.
export interface ManifestDriver extends KitManifestDriver {
  readonly capabilities: readonly string[]
  readonly class: string
  readonly capabilitiesOptions?: Record<
    string,
    ManifestDriverCapabilitiesOptions
  >
  readonly pair?: readonly (LoginSetting | PairSetting)[]
}

export interface ManifestDriverCapabilitiesOptions {
  readonly title: LocalizedStrings
  readonly type: string
  // Numeric bounds as the manifest declares them: the widgets build
  // their pickers from these rather than from constants of their own.
  readonly max?: number | undefined
  readonly min?: number | undefined
  readonly step?: number | undefined
  readonly values?: readonly CapabilitiesOptionsValues<string>[] | undefined
}

// The flow cards the app declares: run listeners are wired for exactly
// these ids, so a driver reads them rather than probing the registry.
export interface ManifestFlow {
  readonly actions: readonly ManifestFlowCard[]
  readonly conditions: readonly ManifestFlowCard[]
}

export interface ManifestFlowCard {
  readonly id: string
}
