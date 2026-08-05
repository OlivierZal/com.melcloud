// Widget-side freshness bootstrap: one shared decision for every widget
// entry. The twin primitive stays transport-free; this wrapper feeds it
// the promise-native widget transport and the boot-error breadcrumb
// channel.
import type HomeyWidget from 'homey/lib/HomeyWidget'

import { fireAndForget, homeyApiGet, homeyApiPost } from './homey-api.mts'
import { ensureFreshWebview } from './webview-freshness.mts'

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
