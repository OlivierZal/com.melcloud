// Widget-side freshness bootstrap: one shared decision for every widget
// entry. The twin primitive stays transport-free; this wrapper feeds it
// the promise-native widget transport and the boot-error breadcrumb
// channel.
import type HomeyWidget from 'homey/lib/HomeyWidget'
import { ensureFreshWebview } from '@olivierzal/homey-kit/webview'

import { fireAndForget, homeyApiGet, homeyApiPost } from './homey-api.mts'

// A stale cached page refetches itself once (never-cached address)
// instead of booting: when this resolves `true` the caller must skip its
// init — the document is about to be replaced.
export const ensureFreshWidget = async (
  homey: HomeyWidget,
  entry: string,
): Promise<boolean> =>
  ensureFreshWebview(
    entry,
    async () => homeyApiGet(homey, '/webview-hashes'),
    (message) => {
      fireAndForget(
        homeyApiPost(homey, '/boot-error', {
          message,
          name: 'WebviewFreshness',
        }),
        () => {
          // A missed freshness breadcrumb is acceptable.
        },
      )
    },
  )

// Second trigger of the same handshake: the app pokes open pages at its
// own (re)boot, when the served hashes may have moved; a failed recheck
// must never break a live page (every path inside is already fail-open).
export const watchWebviewFreshness = (
  homey: HomeyWidget,
  entry: string,
): void => {
  homey.on('webview_hashes_changed', () => {
    fireAndForget(ensureFreshWidget(homey, entry), () => {
      // The next boot pull re-checks anyway.
    })
  })
}
