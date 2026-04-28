import type * as Home from '@olivierzal/melcloud-api/home'
import {
  fanSpeedFromClassic,
  fanSpeedToClassic,
  horizontalFromClassic,
  horizontalToClassic,
  operationModeFromClassic,
  operationModeToClassic,
  verticalFromClassic,
  verticalToClassic,
} from '@olivierzal/melcloud-api'
import { DateTime } from 'luxon'
import * as Classic from '@olivierzal/melcloud-api/classic'

import type { ClassicDeviceFacade } from '../../types/device.mts'
import type {
  HomeCapabilitiesAta,
  HomeConvertFromDevice,
  HomeConvertToDevice,
  HomeSetCapabilitiesAta,
} from '../../types/home-ata.mts'
import {
  horizontalFromDevice,
  operationModeFromDevice,
  ThermostatModeAta,
  verticalFromDevice,
} from '../../types/ata.mts'
import { BaseMELCloudDevice } from '../base-device.mts'

const DAILY_ENERGY_CAPABILITY = 'meter_power.daily'

export default class HomeMELCloudDeviceAta extends BaseMELCloudDevice {
  declare public readonly getData: () => { id: string }

  public override get id(): string {
    return this.getData().id
  }

  protected readonly capabilityToDevice: Partial<
    Record<keyof HomeSetCapabilitiesAta, HomeConvertToDevice>
  > = {
    fan_speed: (value: Classic.FanSpeed) => fanSpeedFromClassic[value],
    horizontal: (value: keyof typeof Classic.Horizontal) =>
      horizontalFromClassic[Classic.Horizontal[value]],
    thermostat_mode: (value: keyof typeof Classic.OperationMode) =>
      operationModeFromClassic[Classic.OperationMode[value]],
    vertical: (value: keyof typeof Classic.Vertical) =>
      verticalFromClassic[Classic.Vertical[value]],
  }

  protected readonly deviceToCapability: Record<
    keyof HomeCapabilitiesAta,
    HomeConvertFromDevice
  > = {
    fan_speed: ({ setFanSpeed }) => fanSpeedToClassic[setFanSpeed],
    horizontal: ({ vaneHorizontalDirection }) =>
      horizontalFromDevice[horizontalToClassic[vaneHorizontalDirection]],
    measure_signal_strength: ({ rssi }) => rssi,
    measure_temperature: ({ roomTemperature }) => roomTemperature,
    onoff: ({ power }) => power,
    target_temperature: ({ setTemperature }) => setTemperature,
    thermostat_mode: ({ operationMode, power }) =>
      power ?
        operationModeFromDevice[operationModeToClassic[operationMode]]
      : ThermostatModeAta.off,
    vertical: ({ vaneVerticalDirection }) =>
      verticalFromDevice[verticalToClassic[vaneVerticalDirection]],
  }

  protected readonly energyReportRegular = null

  protected readonly energyReportTotal = null

  protected readonly thermostatMode: typeof ThermostatModeAta =
    ThermostatModeAta

  #energyReportInterval: NodeJS.Timeout | null = null

  #energyReportTimeout: NodeJS.Timeout | null = null

  public override async syncFromDevice(): Promise<void> {
    const device = await this.ensureDevice()
    if (!device) {
      return
    }
    await this.#setCapabilityValues(device)
  }

  protected override async applyCapabilitiesOptions(): Promise<void> {
    /* v8 ignore next -- cachedFacade is always set before init() calls applyCapabilitiesOptions */
    if (!this.cachedFacade || !('capabilities' in this.cachedFacade)) {
      return
    }
    await super.applyCapabilitiesOptions(this.cachedFacade.capabilities)
  }

  protected override cleanupDevice(): void {
    super.cleanupDevice()
    if (this.#energyReportTimeout) {
      this.homey.clearTimeout(this.#energyReportTimeout)
      this.#energyReportTimeout = null
    }
    if (this.#energyReportInterval) {
      this.homey.clearInterval(this.#energyReportInterval)
      this.#energyReportInterval = null
    }
  }

  /* v8 ignore start -- never called: energyReportRegular/Total are null, scheduleEnergyReports overridden */
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- required override of abstract method; Home devices schedule their own energy reports
  protected override createEnergyReport(): never {
    throw new Error('Energy reports are not supported for Home devices')
  }
  /* v8 ignore stop */

  /* v8 ignore next -- tested via TestHomeDevice which provides its own implementation */
  protected override getFacade(): Home.DeviceAtaFacade {
    return this.homey.app.getHomeFacade(this.id)
  }

  protected override async scheduleEnergyReports(): Promise<void> {
    if (!this.hasCapability(DAILY_ENERGY_CAPABILITY)) {
      return
    }
    await this.#fetchDailyEnergy()
    this.#scheduleDailyEnergy()
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this -- pure helper kept close to its caller for readability
  #dailyEnergyWindow(): { from: string; to: string } | null {
    const todayStart = DateTime.utc().startOf('day')
    const from = todayStart.toISO()
    const to = todayStart.plus({ days: 1 }).toISO()
    /* v8 ignore next -- toISO() only returns null for invalid DateTimes; startOf('day') on DateTime.utc() is always valid */
    return from && to ? { from, to } : null
  }

  async #fetchDailyEnergy(): Promise<void> {
    const device = await this.ensureDevice()
    if (!device) {
      return
    }
    const window = this.#dailyEnergyWindow()
    /* v8 ignore next -- toISO() only returns null for invalid DateTimes; startOf('day') on DateTime.utc() is always valid */
    if (!window) {
      return
    }
    const kwh = await this.#queryDailyEnergy(window.from, window.to)
    if (kwh !== null) {
      await this.setCapabilityValue(DAILY_ENERGY_CAPABILITY, kwh)
    }
  }

  async #queryDailyEnergy(from: string, to: string): Promise<number | null> {
    try {
      const result = await this.getFacade().getEnergy({
        from,
        interval: 'Day',
        to,
      })
      if (!result.ok) {
        this.error('Home daily energy fetch failed:', result.error)
        return null
      }
      return Number(result.value.measureData[0]?.values[0]?.value ?? 0)
    } catch (error) {
      this.error('Home daily energy fetch error:', error)
      return null
    }
  }

  #scheduleDailyEnergy(): void {
    if (this.#energyReportTimeout) {
      return
    }
    const actionType = 'home daily energy report'
    this.#energyReportTimeout = this.setTimeout(
      async () => {
        await this.#fetchDailyEnergy()
        this.#energyReportInterval = this.setInterval(
          async () => this.#fetchDailyEnergy(),
          { hours: 1 },
          actionType,
        )
      },
      DateTime.utc()
        .plus({ hours: 1 })
        .startOf('hour')
        .plus({ minutes: 5 })
        .diffNow(),
      actionType,
    )
  }

  async #setCapabilityValues(device: ClassicDeviceFacade): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- converters accept ClassicDeviceFacade at runtime; concrete HomeConvertFromDevice type is narrower for bivariance
    const converters = Object.entries(this.deviceToCapability) as [
      string,
      (device: ClassicDeviceFacade) => unknown,
    ][]
    await Promise.all(
      converters.map(async ([capability, convert]) => {
        /* v8 ignore next -- hasCapability always true in tests */
        if (this.hasCapability(capability)) {
          await this.setCapabilityValue(capability, convert(device))
        }
      }),
    )
  }
}
