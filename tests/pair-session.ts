import type PairSession from 'homey/lib/PairSession'
import { vi } from 'vitest'

import { mock } from './helpers.ts'

interface ListDevicesSession {
  readonly listHandler: ReturnType<
    typeof vi.fn<(...args: unknown[]) => unknown>
  >
  readonly session: PairSession
}

// Pairing hands the driver a session it registers handlers on; a suite
// drives the listing by capturing the `list_devices` one and calling it.
// `showViewMock` stays the caller's, so each suite keeps asserting on its
// own view navigation.
export const createListDevicesSession = (
  showViewMock: ReturnType<typeof vi.fn<(view: string) => Promise<void>>>,
): ListDevicesSession => {
  const listHandler = vi.fn<(...args: unknown[]) => unknown>()
  const session = mock<PairSession>({
    setHandler: vi
      .fn<(event: string, handler: (...args: unknown[]) => unknown) => void>()
      .mockImplementation(
        (event: string, handler: (...args: unknown[]) => unknown) => {
          if (event === 'list_devices') {
            listHandler.mockImplementation(handler)
          }
        },
      ),
    showView: showViewMock,
  })
  return { listHandler, session }
}
