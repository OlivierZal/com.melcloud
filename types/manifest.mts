import type { CapabilitiesOptionsValues, LocalizedStrings } from './bases.mts'

interface ManifestDriverSetting {
  readonly label: LocalizedStrings
  readonly children?: readonly ManifestDriverSettingData[]
  readonly id?: string
}

interface ManifestDriverSettingData {
  readonly id: string
  readonly label: LocalizedStrings
  readonly type: string
  readonly max?: number
  readonly min?: number
  readonly units?: string
  readonly values?: readonly {
    readonly id: string
    readonly label: LocalizedStrings
  }[]
}

interface PairSetting {
  readonly id: string
}

export interface LoginSetting extends PairSetting {
  readonly id: 'login'
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
  readonly version: string
}

export interface ManifestDriver {
  readonly capabilities: readonly string[]
  readonly id: string
  readonly name: LocalizedStrings
  readonly capabilitiesOptions?: Record<
    string,
    ManifestDriverCapabilitiesOptions
  >
  readonly pair?: readonly (LoginSetting | PairSetting)[]
  readonly settings?: readonly ManifestDriverSetting[]
}

export interface ManifestDriverCapabilitiesOptions {
  readonly title: LocalizedStrings
  readonly type: string
  readonly values?: readonly CapabilitiesOptionsValues<string>[] | undefined
}
