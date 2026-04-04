import type { DeviceType, ListDeviceDataAta } from '@olivierzal/melcloud-api'

import type { EnergyReportConfig } from '../../drivers/base-report.mts'
import type {
  ConvertFromDevice,
  ConvertToDevice,
  OperationalCapabilities,
  SetCapabilities,
} from '../../types/index.mts'
import { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import { createInstance } from './create-test-instance.ts'

type TestDeviceType = typeof DeviceType.Ata

export type { TestDeviceType }
export class TestDevice extends BaseMELCloudDevice<TestDeviceType> {
  public capabilityToDevice: Partial<
    Record<
      keyof SetCapabilities<TestDeviceType>,
      ConvertToDevice<TestDeviceType>
    >
  > = {}

  public readonly deviceToCapability: Partial<
    Record<
      keyof OperationalCapabilities<TestDeviceType>,
      ConvertFromDevice<TestDeviceType>
    >
  > = {}

  public readonly energyReportRegular: EnergyReportConfig | null = null

  public readonly energyReportTotal: EnergyReportConfig | null = null

  public readonly thermostatMode: Record<string, string> | null = null

  public get exposedFacade(): typeof this.facade {
    return this.facade
  }

  public async exposedSetCapabilityValues(
    data: ListDeviceDataAta,
  ): Promise<void> {
    await this.setCapabilityValues(data)
  }
}

export const createTestDevice = (): TestDevice => createInstance(TestDevice)
