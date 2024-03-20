import 'source-map-support/register'
import 'core-js/actual/object/group-by'
import { App, type Driver } from 'homey'
import type {
  Building,
  DeviceType,
  ListDeviceAny,
  LoginCredentials,
} from './melcloud/types'
import { Settings as LuxonSettings } from 'luxon'
import MELCloudAPI from './melcloud/api'
import type { MELCloudDevice } from './types'
import withTimers from './mixins/withTimers'

export = class MELCloudApp extends withTimers(App) {
  public readonly melcloudAPI: MELCloudAPI = new MELCloudAPI(
    this.homey.settings,
    this.log.bind(this),
    this.error.bind(this),
  )

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

  public async applyLogin(
    data?: LoginCredentials,
    raise = false,
  ): Promise<boolean> {
    return this.melcloudAPI.applyLogin(
      data,
      async (): Promise<void> => this.#runSyncFromDevices(),
      raise,
    )
  }

  public clearSyncFromDevices(): void {
    this.homey.clearInterval(this.#syncFromDevicesInterval)
    this.#syncFromDevicesInterval = null
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

  public async onInit(): Promise<void> {
    LuxonSettings.defaultLocale = 'en-us'
    LuxonSettings.defaultZone = this.homey.clock.getTimezone()
    await this.applyLogin()
  }

  async #runSyncFromDevices(): Promise<void> {
    if (!this.#syncFromDevicesInterval) {
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
  }

  async #syncFromDeviceList(): Promise<void> {
    try {
      const buildingDevices: ListDeviceAny[] = (
        await this.getBuildings()
      ).flatMap(
        ({
          Structure: { Devices: devices, Areas: areas, Floors: floors },
        }): ListDeviceAny[] => [
          ...devices,
          ...areas.flatMap(
            ({ Devices: areaDevices }): readonly ListDeviceAny[] => areaDevices,
          ),
          ...floors.flatMap((floor): ListDeviceAny[] => [
            ...floor.Devices,
            ...floor.Areas.flatMap(
              ({ Devices: areaDevices }): readonly ListDeviceAny[] =>
                areaDevices,
            ),
          ]),
        ],
      )
      this.#devicesPerType = Object.groupBy<DeviceType, ListDeviceAny>(
        buildingDevices,
        ({ Device }) => Device.DeviceType,
      )
      const devicesPerId: Partial<Record<number, readonly ListDeviceAny[]>> =
        Object.groupBy<number, ListDeviceAny>(
          buildingDevices,
          ({ DeviceID }) => DeviceID,
        )
      this.#devices = Object.fromEntries(
        Object.entries(devicesPerId).map(
          ([id, devices]: [string, readonly ListDeviceAny[] | undefined]): [
            string,
            ListDeviceAny,
          ] => {
            const [device]: readonly ListDeviceAny[] = devices ?? []
            return [id, device]
          },
        ),
      )
      await this.#syncFromDevices()
    } catch (error: unknown) {
      // Error handling is delegated to the interceptor
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
