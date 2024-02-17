import 'source-map-support/register'
import {
  APP_VERSION,
  type Building,
  type HeatPumpType,
  type ListDeviceAny,
} from './types/MELCloudAPITypes'
import type { DeviceLookup, LoginCredentials } from './types/types'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from './lib/MELCloudAPI'
import withTimers from './mixins/withTimers'

const DEFAULT_DEVICES_PER_TYPE: DeviceLookup['devicesPerType'] = {
  0: [],
  1: [],
  3: [],
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const flattenDevices = (
  flattenedDevices: DeviceLookup,
  devices: readonly ListDeviceAny[],
): DeviceLookup =>
  devices.reduce<DeviceLookup>(
    (acc, device) => {
      acc.devicesPerId[device.DeviceID] = device
      const type: HeatPumpType = device.Device.DeviceType
      if (!(type in acc.devicesPerType)) {
        acc.devicesPerType[type] = []
      }
      acc.devicesPerType[type].push(device)
      return acc
    },
    {
      devicesPerId: { ...flattenedDevices.devicesPerId },
      devicesPerType: { ...flattenedDevices.devicesPerType },
    },
  )

const throwIfRequested = (error: unknown, raise: boolean): void => {
  if (raise) {
    throw new Error(getErrorMessage(error))
  }
}

export = class MELCloudApp extends withTimers(App) {
  public readonly melcloudAPI: MELCloudAPI = MELCloudAPI.getInstance(
    this.homey.settings,
    this.log.bind(this),
    this.error.bind(this),
  )

  #devicesPerId: Record<number, ListDeviceAny> = {}

  #devicesPerType: Record<string, readonly ListDeviceAny[]> = {}

  #syncInterval: NodeJS.Timeout | null = null

  public get devicesPerId(): Record<number, ListDeviceAny> {
    return this.#devicesPerId
  }

  public get devicesPerType(): Record<string, readonly ListDeviceAny[]> {
    return this.#devicesPerType
  }

  public async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    if (await this.melcloudAPI.planRefreshLogin()) {
      await this.#syncDevicesFromList()
    }
  }

  public async login(
    { password, username }: LoginCredentials,
    raise = false,
  ): Promise<boolean> {
    if (username && password) {
      try {
        const { LoginData } = (
          await this.melcloudAPI.login({
            AppVersion: APP_VERSION,
            Email: username,
            Password: password,
            Persist: true,
          })
        ).data
        if (LoginData && !this.#syncInterval) {
          await this.melcloudAPI.planRefreshLogin()
          await this.runSyncFromDevices()
        }
        return Boolean(LoginData)
      } catch (error: unknown) {
        throwIfRequested(error, raise)
      }
    }
    return false
  }

  public async runSyncFromDevices(): Promise<void> {
    this.clearSyncDevicesFromList()
    await this.#syncDevicesFromList()
    this.#syncInterval = this.setInterval(
      async (): Promise<void> => {
        await this.#syncDevicesFromList()
      },
      { minutes: 5 },
      { actionType: 'sync with device', units: ['minutes'] },
    )
  }

  public clearSyncDevicesFromList(): void {
    this.homey.clearInterval(this.#syncInterval)
    this.log('Device list refresh has been paused')
  }

  public async getBuildings(): Promise<Building[]> {
    try {
      return (await this.melcloudAPI.list()).data
    } catch (error: unknown) {
      throw new Error(getErrorMessage(error))
    }
  }

  async #syncDevicesFromList(): Promise<void> {
    try {
      const { devicesPerId, devicesPerType } = (
        await this.getBuildings()
      ).reduce<DeviceLookup>(
        (
          acc,
          { Structure: { Devices: devices, Areas: areas, Floors: floors } },
        ) => {
          let newAcc = { ...acc }
          newAcc = flattenDevices(newAcc, devices)
          areas.forEach(({ Devices: areaDevices }) => {
            newAcc = flattenDevices(newAcc, areaDevices)
          })
          floors.forEach((floor) => {
            newAcc = flattenDevices(newAcc, floor.Devices)
            floor.Areas.forEach(({ Devices: areaDevices }) => {
              newAcc = flattenDevices(newAcc, areaDevices)
            })
          })
          return newAcc
        },
        { devicesPerId: {}, devicesPerType: DEFAULT_DEVICES_PER_TYPE },
      )
      this.#devicesPerId = devicesPerId
      this.#devicesPerType = devicesPerType
    } catch (error: unknown) {
      // Pass
    }
  }
}
