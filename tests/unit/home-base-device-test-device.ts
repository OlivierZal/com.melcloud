import type * as Home from '@olivierzal/melcloud-api/home'

import type { HomeSetCapabilitiesAta } from '../../types/home-ata.mts'
import type { HomeConvertToDevice } from '../../types/home.mts'
import HomeMELCloudDeviceAta from '../../drivers/home-melcloud/device.mts'
import { createInstance } from './create-test-instance.ts'

export class TestHomeDevice extends HomeMELCloudDeviceAta {
  public override capabilityToDevice: Partial<
    Record<
      keyof HomeSetCapabilitiesAta,
      HomeConvertToDevice<typeof Home.DeviceType.Ata>
    >
  > = {}

  public override readonly deviceToCapability = {
    measure_temperature: (facade: { roomTemperature: number }) =>
      facade.roomTemperature,
    onoff: (facade: { power: boolean }) => facade.power,
    target_temperature: (facade: { setTemperature: number }) =>
      facade.setTemperature,
    thermostat_mode: (facade: { operationMode: string; power: boolean }) =>
      facade.power ? facade.operationMode : 'off',
  } as unknown as HomeMELCloudDeviceAta['deviceToCapability']

  public override readonly thermostatMode =
    null as unknown as HomeMELCloudDeviceAta['thermostatMode']

  public get exposedFacade(): typeof this.cachedFacade {
    return this.cachedFacade
  }
}

export const createTestHomeDevice = (): TestHomeDevice =>
  createInstance(TestHomeDevice)
