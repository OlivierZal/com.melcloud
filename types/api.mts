import type { LoginCredentials } from '@olivierzal/melcloud-api'

/** Identifier for one of the two MELCloud APIs. */
export type Api = 'classic' | 'home'

/** Minimal API-client surface used by drivers during pairing/repair. */
export interface AuthAPI {
  readonly authenticate: (credentials: LoginCredentials) => Promise<void>
  readonly isAuthenticated: () => boolean
}
