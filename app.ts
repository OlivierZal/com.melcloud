import 'core-js/actual/object/group-by'
import 'source-map-support/register'
import { App, type Driver } from 'homey'
import {
  type Building,
  HeatPumpType,
  type ListDeviceAny,
  type LoginCredentials,
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

  #devicesPerId: Partial<Record<number, readonly ListDeviceAny[]>> = {}

  #devicesPerType: Partial<Record<HeatPumpType, readonly ListDeviceAny[]>> = {
    [HeatPumpType.Ata]: [],
    [HeatPumpType.Atw]: [],
    [HeatPumpType.Erv]: [],
  }

  #syncFromDevicesInterval: NodeJS.Timeout | null = null

  public get devicesPerType(): Partial<
    Record<HeatPumpType, readonly ListDeviceAny[]>
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

  public getDeviceFromList(id: number): ListDeviceAny | null {
    const [device]: readonly ListDeviceAny[] = this.#devicesPerId[id] ?? []
    return (device as ListDeviceAny | undefined) ?? null
  }

  public getDeviceIds(): string[] {
    return Object.keys(this.#devicesPerId)
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
      /* eslint-disable
        @typescript-eslint/no-unsafe-assignment,
        @typescript-eslint/no-unsafe-call,
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-return
      */
      this.#devicesPerId = Object.groupBy<number, ListDeviceAny>(
        buildingDevices,
        ({ DeviceID }) => DeviceID,
      )
      this.#devicesPerType = Object.groupBy<HeatPumpType, ListDeviceAny>(
        buildingDevices,
        ({ Device }) => Device.DeviceType,
      )
      /* eslint-enable
        @typescript-eslint/no-unsafe-assignment,
        @typescript-eslint/no-unsafe-call,
        @typescript-eslint/no-unsafe-member-access,
        @typescript-eslint/no-unsafe-return
      */
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
