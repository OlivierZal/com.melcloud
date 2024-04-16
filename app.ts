import 'source-map-support/register'
import 'core-js/actual/object/group-by'
import type {
  Building,
  DeviceType,
  ListDeviceAny,
  LoginCredentials,
} from './melcloud/types'
import { App } from 'homey'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from './melcloud/api'
import type { MELCloudDevice } from './types'
import withTimers from './mixins/withTimers'

export = class MELCloudApp extends withTimers(App) {
  public readonly melcloudAPI = new MELCloudAPI(this.homey.settings, this)

  #devices: Partial<Record<number, ListDeviceAny>> = {}

  #devicesPerType: Partial<Record<DeviceType, readonly ListDeviceAny[]>> = {}

  #syncFromDevicesInterval: NodeJS.Timeout | null = null

  public get devices(): Partial<Record<number, ListDeviceAny>> {
    return this.#devices
  }

  public get devicesPerType(): Partial<
    Record<DeviceType, readonly ListDeviceAny[]>
  > {
    return this.#devicesPerType
  }

  public async applyLogin(data?: LoginCredentials): Promise<boolean> {
    if (typeof data !== 'undefined') {
      this.#clearSyncFromDevices()
    }
    return this.melcloudAPI.applyLogin(
      data,
      async (): Promise<void> => this.#runSyncFromDevices(),
    )
  }

  public async getBuildings(): Promise<Building[]> {
    return (await this.melcloudAPI.list()).data
  }

  public getDevices({
    buildingId,
    driverId,
  }: { buildingId?: number; driverId?: string } = {}): MELCloudDevice[] {
    let devices = (
      typeof driverId === 'undefined' ?
        Object.values(this.homey.drivers.getDrivers())
      : [this.homey.drivers.getDriver(driverId)]).flatMap(
      (driver) => driver.getDevices() as MELCloudDevice[],
    )
    if (typeof buildingId !== 'undefined') {
      devices = devices.filter(({ buildingid }) => buildingid === buildingId)
    }
    return devices
  }

  public async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.applyLogin()
  }

  #clearSyncFromDevices(): void {
    this.homey.clearInterval(this.#syncFromDevicesInterval)
    this.#syncFromDevicesInterval = null
    this.log('Device list refresh has been paused')
  }

  async #runSyncFromDevices(): Promise<void> {
    if (!this.#syncFromDevicesInterval) {
      this.#clearSyncFromDevices()
      await this.#syncFromDeviceList()
      this.#syncFromDevicesInterval = this.setInterval(
        async (): Promise<void> => {
          await this.#syncFromDeviceList()
        },
        { minutes: 5 },
        { actionType: 'device list refresh', units: ['minutes'] },
      )
    }
  }

  async #syncFromDeviceList(): Promise<void> {
    try {
      const buildingDevices = (await this.getBuildings()).flatMap(
        ({ Structure: { Devices: devices, Areas: areas, Floors: floors } }) => [
          ...devices,
          ...areas.flatMap(({ Devices: areaDevices }) => areaDevices),
          ...floors.flatMap((floor) => [
            ...floor.Devices,
            ...floor.Areas.flatMap(({ Devices: areaDevices }) => areaDevices),
          ]),
        ],
      )
      const devicesPerId = Object.groupBy<number, ListDeviceAny>(
        buildingDevices,
        ({ DeviceID }) => DeviceID,
      )
      this.#devicesPerType = Object.groupBy<DeviceType, ListDeviceAny>(
        buildingDevices,
        ({ Device }) => Device.DeviceType,
      )
      this.#devices = Object.fromEntries(
        Object.entries(devicesPerId).map(([id, devices]) => {
          const [device] = devices ?? []
          return [id, device]
        }),
      )
      await this.#syncFromDevices()
    } catch (error) {
      // Error handling is delegated to the interceptor
    }
  }

  async #syncFromDevices(): Promise<void> {
    await Promise.all(
      this.getDevices().map(async (device) => device.syncFromDevice()),
    )
  }
}
