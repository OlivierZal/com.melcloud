import type { DeviceType, ListDeviceDataAta } from '@olivierzal/melcloud-api'
import { vi } from 'vitest'

import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/index.mts'
import { BaseMELCloudDriver } from '../../drivers/base-driver.mts'
import { mock } from '../helpers.ts'
import { createInstance } from './create-test-instance.ts'

type TestDriverType = typeof DeviceType.Ata

export type { TestDriverType }
export class TestDriver extends BaseMELCloudDriver<TestDriverType> {
  public readonly energyCapabilityTagMapping = mock<
    EnergyCapabilityTagMapping<TestDriverType>
  >({
    measure_power: ['Auto', 'Cooling'],
  })

  public readonly getCapabilitiesOptions = vi.fn().mockReturnValue({})

  public readonly getCapabilityTagMapping = mock<
    GetCapabilityTagMapping<TestDriverType>
  >({
    measure_temperature: 'RoomTemperature',
  })

  public readonly listCapabilityTagMapping = mock<
    ListCapabilityTagMapping<TestDriverType>
  >({})

  public readonly setCapabilityTagMapping = mock<
    SetCapabilityTagMapping<TestDriverType>
  >({
    onoff: 'Power',
    thermostat_mode: 'OperationMode',
  })

  public readonly type: TestDriverType = 0

  public getRequiredCapabilities(_context: ListDeviceDataAta): string[] {
    return Object.keys(this.setCapabilityTagMapping)
  }
}

export const createTestDriver = (): TestDriver => createInstance(TestDriver)
