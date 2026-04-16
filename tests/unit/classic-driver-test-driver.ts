import type * as Classic from '@olivierzal/melcloud-api/classic'
import { vi } from 'vitest'

import type {
  EnergyCapabilityTagMapping,
  GetCapabilityTagMapping,
  ListCapabilityTagMapping,
  SetCapabilityTagMapping,
} from '../../types/capabilities.mts'
import { ClassicMELCloudDriver } from '../../drivers/classic-driver.mts'
import { mock } from '../helpers.ts'
import { createInstance } from './create-test-instance.ts'

type TestDriverType = typeof Classic.DeviceType.Ata

export type { TestDriverType }
export class TestDriver extends ClassicMELCloudDriver<TestDriverType> {
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

  public getRequiredCapabilities(): string[] {
    return Object.keys(this.setCapabilityTagMapping)
  }
}

export const createTestDriver = (): TestDriver => createInstance(TestDriver)
