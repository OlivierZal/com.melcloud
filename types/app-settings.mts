/**
 * Keys the app persists through `homey.settings`: the melcloud-api
 * session material of both dialects (written via the lib's
 * `SettingManager`, Home's namespaced by the `home` prefix) plus the
 * app's own bookkeeping. `tests/unit/app-settings-contract.test.ts`
 * pins this union against what the library actually writes.
 */
export interface HomeySettings {
  readonly contextKey?: string | null
  readonly expiry?: string | null
  readonly homeAccessToken?: string | null
  readonly homeExpiry?: string | null
  readonly homeLoginBackoffUntil?: string | null
  readonly homePassword?: string | null
  readonly homeRefreshToken?: string | null
  readonly homeUsername?: string | null
  readonly loginBackoffUntil?: string | null
  readonly notifiedVersion?: string | null
  readonly password?: string | null
  readonly username?: string | null
}
