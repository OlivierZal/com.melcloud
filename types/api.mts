import type {
  AggregatedHolidayModeState,
  AggregatedProtectionState,
  BaseAPIAdapter,
  HolidayModeState,
  ProtectionState,
} from '@olivierzal/melcloud-api'

/**
 * Identifier for one of the two MELCloud APIs.
 */
export type Api = 'classic' | 'home'

/**
 * Minimal API-client surface used by drivers during pairing/repair —
 * the library's published adapter contract, narrowed to what pairing
 * touches.
 */
export type AuthenticationAPI = Pick<
  BaseAPIAdapter,
  'authenticate' | 'isAuthenticated'
>

/**
 * What the sign-in route answers once the server accepted the
 * credentials. The library enforces a registry sync after the sign-in
 * itself, so an accepted account can still end up with a device list
 * the app could not refresh: `isDeviceListStale` carries that
 * half-failure to the page, which reports it WITHOUT sending the user
 * back to the login form.
 */
export interface AuthenticationResult {
  readonly isDeviceListStale: boolean
}

/**
 * Holiday-mode window as the settings webview submits it: an absent
 * bound means "start (or end) now", completed app-side on the HOMEY's
 * clock — the one clock every entry point shares, whatever timezone
 * the phone sits in.
 */
export interface HolidayModeSettings {
  readonly isEnabled: boolean
  readonly endDate?: string
  readonly startDate?: string
}

/**
 * What a settings target answers for its holiday window: a single
 * target's state, a multi-device target's per-field aggregate, or
 * `null` when never configured.
 */
export type TargetHolidayModeState =
  AggregatedHolidayModeState | HolidayModeState | null

/**
 * What a settings target answers for a protection read — the
 * protection twin of {@link TargetHolidayModeState}.
 */
export type TargetProtectionState =
  AggregatedProtectionState | ProtectionState | null
