// eslint-disable-next-line import-x/no-extraneous-dependencies -- Platform module provided by Homey runtime
import Homey from 'homey'

// eslint-disable-next-line import-x/no-named-as-default-member -- Homey CJS module: named imports cause runtime error
export const { App, Device, Driver } = Homey

export type { Homey }
