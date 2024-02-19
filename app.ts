import 'source-map-support/register'
import {
  APP_VERSION,
  type Building,
  HeatPumpType,
  type ListDeviceAny,
} from './types/MELCloudAPITypes'
import { App, type Driver } from 'homey'
import type {
  DeviceLookup,
  LoginCredentials,
  MELCloudDevice,
} from './types/types'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from './lib/MELCloudAPI'
import withTimers from './mixins/withTimers'

const DEFAULT_DEVICES_PER_TYPE: DeviceLookup['devicesPerType'] = {
  [HeatPumpType.Ata]: [],
  [HeatPumpType.Atw]: [],
  [HeatPumpType.Erv]: [],
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

  #devicesPerType: Record<string, readonly ListDeviceAny[]> =
    DEFAULT_DEVICES_PER_TYPE

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
      await this.#runSyncFromDevices()
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
          await this.#runSyncFromDevices()
        }
        return LoginData !== null
      } catch (error: unknown) {
        throwIfRequested(error, raise)
      }
    }
    return false
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

  public getDevices({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): MELCloudDevice[] {
    let devices: MELCloudDevice[] = (
      typeof driverId === 'undefined'
        ? Object.values(this.homey.drivers.getDrivers())
        : [this.homey.drivers.getDriver(driverId)]
    ).flatMap(
      (driver: Driver): MELCloudDevice[] =>
        driver.getDevices() as MELCloudDevice[],
    )
    if (typeof buildingId !== 'undefined') {
      devices = devices.filter(({ buildingid }) => buildingid === buildingId)
    }
    return devices
  }

  async #runSyncFromDevices(): Promise<void> {
    this.clearSyncDevicesFromList()
    await this.#syncDevicesFromList()
    this.#syncInterval = this.setInterval(
      async (): Promise<void> => {
        await this.#syncDevicesFromList()
      },
      { minutes: 5 },
      { actionType: 'device list refresh', units: ['minutes'] },
    )
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
      await this.#syncDevices()
    } catch (error: unknown) {
      // Pass
    }
  }

  async #syncDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device: MELCloudDevice) =>
        device.syncFromDevice(),
      ),
    )
  }
}
