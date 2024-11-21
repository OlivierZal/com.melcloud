import type HomeyLib from 'homey/lib/Homey'

import type MELCloudApp from './app.mts'

declare module 'homey/lib/Homey' {
  interface Homey extends HomeyLib {
    app: MELCloudApp
  }
}
