import type MELCloudApp from './app.mts'

declare module 'homey' {
  interface HomeyTypes {
    app: MELCloudApp
  }
}
