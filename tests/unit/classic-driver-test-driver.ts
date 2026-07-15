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
  public readonly getCapabilitiesOptions: ReturnType<
    typeof vi.fn<() => Partial<Record<string, unknown>>>
  > = vi.fn<() => Partial<Record<string, unknown>>>().mockReturnValue({})

  public readonly tagMappings: {
    readonly energy: EnergyCapabilityTagMapping<TestDriverType>
    readonly get: GetCapabilityTagMapping<TestDriverType>
    readonly list: ListCapabilityTagMapping<TestDriverType>
    readonly set: SetCapabilityTagMapping<TestDriverType>
  } = {
    energy: mock<EnergyCapabilityTagMapping<TestDriverType>>({
      measure_power: ['Auto', 'Cooling'],
    }),
    get: mock<GetCapabilityTagMapping<TestDriverType>>({
      measure_temperature: 'RoomTemperature',
    }),
    list: mock<ListCapabilityTagMapping<TestDriverType>>({}),
    set: mock<SetCapabilityTagMapping<TestDriverType>>({
      onoff: 'Power',
      thermostat_mode: 'OperationMode',
      // Dotted variant: its flow cards reuse the base capability's arg
      // name (see `getArg` in base-driver.mts).
      'thermostat_mode.zone2': 'OperationModeZone2',
    }),
  }

  public readonly type: TestDriverType = 0

  public getRequiredCapabilities(): string[] {
    return Object.keys(this.tagMappings.set)
  }
}

export const createTestDriver = (): TestDriver => createInstance(TestDriver)
