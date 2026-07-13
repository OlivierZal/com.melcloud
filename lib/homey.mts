import Homey from 'homey'

/* eslint-disable @typescript-eslint/prefer-destructuring -- TS9019: isolatedDeclarations bans exported binding elements */
export const App: typeof Homey.App = Homey.App
export const Device: typeof Homey.Device = Homey.Device
export const Driver: typeof Homey.Driver = Homey.Driver
/* eslint-enable @typescript-eslint/prefer-destructuring */

export type { default as Homey } from 'homey'
