import type * as Home from '@olivierzal/melcloud-api/home'
import { vi } from 'vitest'

interface HomeDriverMocks {
  readonly authenticateMock: ReturnType<
    typeof vi.fn<(data: unknown) => Promise<boolean>>
  >
  readonly getHomeDevicesByTypeMock: ReturnType<
    typeof vi.fn<(type: Home.DeviceType) => readonly unknown[]>
  >
  readonly getHomeFacadeMock: ReturnType<
    typeof vi.fn<(id: string, type: Home.DeviceType) => unknown>
  >
  readonly isAccountEmptyMock: ReturnType<
    typeof vi.fn<(api: string) => boolean>
  >
  readonly isAuthenticatedMock: ReturnType<typeof vi.fn<() => boolean>>
  readonly isPairingMisdirectedMock: ReturnType<
    typeof vi.fn<(api: string) => boolean>
  >
  readonly setHandlerMock: ReturnType<
    typeof vi.fn<
      (event: string, handler: (...args: unknown[]) => unknown) => void
    >
  >
  readonly showViewMock: ReturnType<
    typeof vi.fn<(view: string) => Promise<void>>
  >
}

// The seam every Home driver suite mocks: the app's device registry, its
// facade lookup and its two pairing reads (empty account, misdirected
// pairing), the session's handler/view pair, and the two auth reads.
// Reached through an async `vi.hoisted`, because the `homey` mock factory
// runs before the importing suite's own body does.
export const createHomeDriverMocks = (): HomeDriverMocks => ({
  authenticateMock: vi.fn<(data: unknown) => Promise<boolean>>(),
  getHomeDevicesByTypeMock:
    vi.fn<(type: Home.DeviceType) => readonly unknown[]>(),
  getHomeFacadeMock: vi.fn<(id: string, type: Home.DeviceType) => unknown>(),
  isAccountEmptyMock: vi.fn<(api: string) => boolean>(() => false),
  isAuthenticatedMock: vi.fn<() => boolean>(),
  isPairingMisdirectedMock: vi.fn<(api: string) => boolean>(() => false),
  setHandlerMock:
    vi.fn<(event: string, handler: (...args: unknown[]) => unknown) => void>(),
  showViewMock: vi.fn<(view: string) => Promise<void>>(),
})
