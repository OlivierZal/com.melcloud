import 'source-map-support/register'
import { App, type Driver } from 'homey'
import {
  type Building,
  HeatPumpType,
  type ListDeviceAny,
  type LoginCredentials,
} from './types/MELCloudAPITypes'
import type { DeviceLookup, MELCloudDevice } from './types/types'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from './lib/MELCloudAPI'
import withTimers from './mixins/withTimers'

const flattenDevices = (
  flattenedDevices: DeviceLookup,
  devices: readonly ListDeviceAny[],
): DeviceLookup =>
  devices.reduce<DeviceLookup>(
    (acc, device) => {
      acc.devicesPerId[device.DeviceID] = device
      acc.devicesPerType[device.Device.DeviceType].push(device)
      return acc
    },
    {
      devicesPerId: { ...flattenedDevices.devicesPerId },
      devicesPerType: { ...flattenedDevices.devicesPerType },
    },
  )

export = class MELCloudApp extends withTimers(App) {
  public readonly melcloudAPI: MELCloudAPI = new MELCloudAPI(
    this.homey.settings,
    this.log.bind(this),
    this.error.bind(this),
  )

  #devicesPerId: Record<number, ListDeviceAny> = {}

  #devicesPerType: Record<string, readonly ListDeviceAny[]> = {
    [HeatPumpType.Ata]: [],
    [HeatPumpType.Atw]: [],
    [HeatPumpType.Erv]: [],
  }

  #syncFromDevicesInterval: NodeJS.Timeout | null = null

  public get devicesPerId(): Record<number, ListDeviceAny> {
    return this.#devicesPerId
  }

  public get devicesPerType(): Record<string, readonly ListDeviceAny[]> {
    return this.#devicesPerType
  }

  public clearSyncFromDevices(): void {
    this.homey.clearInterval(this.#syncFromDevicesInterval)
    this.log('Device list refresh has been paused')
  }

  public async getBuildings(): Promise<Building[]> {
    try {
      return (await this.melcloudAPI.list()).data
    } catch (error: unknown) {
      throw new Error(error instanceof Error ? error.message : String(error))
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

  public async login(
    { password, username }: LoginCredentials,
    raise = false,
  ): Promise<boolean> {
    return this.melcloudAPI.applyLogin(
      { password, username },
      async (): Promise<void> => this.#syncFromDeviceList(),
      raise,
    )
  }

  public async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.melcloudAPI.applyLogin(
      null,
      async (): Promise<void> => this.#runSyncFromDevices(),
    )
  }

  async #runSyncFromDevices(): Promise<void> {
    if (this.#syncFromDevicesInterval) {
      return
    }
    this.clearSyncFromDevices()
    await this.#syncFromDeviceList()
    this.#syncFromDevicesInterval = this.setInterval(
      async (): Promise<void> => {
        await this.#syncFromDeviceList()
      },
      { minutes: 5 },
      { actionType: 'device list refresh', units: ['minutes'] },
    )
  }

  async #syncFromDeviceList(): Promise<void> {
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
            floor.Areas.forEach(({ Devices: floorAreaDevices }) => {
              newAcc = flattenDevices(newAcc, floorAreaDevices)
            })
          })
          return newAcc
        },
        {
          devicesPerId: {},
          devicesPerType: {
            [HeatPumpType.Ata]: [],
            [HeatPumpType.Atw]: [],
            [HeatPumpType.Erv]: [],
          },
        },
      )
      this.#devicesPerId = devicesPerId
      this.#devicesPerType = devicesPerType
      await this.#syncFromDevices()
    } catch (error: unknown) {
      // Pass
    }
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device: MELCloudDevice) =>
        device.syncFromDevice(),
      ),
    )
  }
}
