import HomeySdk from 'homey'

/* eslint-disable @typescript-eslint/prefer-destructuring -- TS9019: isolatedDeclarations bans exported binding elements */
export const App: typeof HomeySdk.App = HomeySdk.App
export const Device: typeof HomeySdk.Device = HomeySdk.Device
export const Driver: typeof HomeySdk.Driver = HomeySdk.Driver
/* eslint-enable @typescript-eslint/prefer-destructuring -- end of the isolatedDeclarations re-exports */
