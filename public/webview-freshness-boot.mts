// Widget-side freshness bootstrap: one shared decision for every widget
// entry. The kit primitive stays transport-free; this wrapper feeds it
// the promise-native widget transport and the boot-error breadcrumb
// channel.
import type HomeyWidget from 'homey/lib/HomeyWidget'
import { watchWebviewFreshness } from '@olivierzal/homey-kit/webview'

import { fireAndForget, homeyApiGet, homeyApiPost } from './homey-api.mts'

// Boot check plus the triggers that cover a page outliving it. When this
// resolves `true` the caller must skip its init — the document is about
// to be replaced by a refetch through a never-cached address.
export const watchWidgetFreshness = async (
  homey: HomeyWidget,
  entry: string,
): Promise<boolean> =>
  watchWebviewFreshness({
    entry,
    fetchHashes: async () => homeyApiGet(homey, '/webview-hashes'),
    report: (message) => {
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
    subscribe: (onPoke) => {
      homey.on('webview_hashes_changed', onPoke)
    },
  })
