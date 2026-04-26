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
  public readonly energyCapabilityTagMapping: EnergyCapabilityTagMapping<TestDriverType> =
    mock<EnergyCapabilityTagMapping<TestDriverType>>({
      measure_power: ['Auto', 'Cooling'],
    })

  public readonly getCapabilitiesOptions: ReturnType<
    typeof vi.fn<() => Partial<Record<string, unknown>>>
  > = vi.fn<() => Partial<Record<string, unknown>>>().mockReturnValue({})

  public readonly getCapabilityTagMapping: GetCapabilityTagMapping<TestDriverType> =
    mock<GetCapabilityTagMapping<TestDriverType>>({
      measure_temperature: 'RoomTemperature',
    })

  public readonly listCapabilityTagMapping: ListCapabilityTagMapping<TestDriverType> =
    mock<ListCapabilityTagMapping<TestDriverType>>({})

  public readonly setCapabilityTagMapping: SetCapabilityTagMapping<TestDriverType> =
    mock<SetCapabilityTagMapping<TestDriverType>>({
      onoff: 'Power',
      thermostat_mode: 'OperationMode',
    })

  public readonly type: TestDriverType = 0

  public getRequiredCapabilities(): string[] {
    return Object.keys(this.setCapabilityTagMapping)
  }
}

export const createTestDriver = (): TestDriver => createInstance(TestDriver)
