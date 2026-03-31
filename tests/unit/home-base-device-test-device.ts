import type {
  HomeAtaValues,
  HomeDeviceAtaFacade,
} from '@olivierzal/melcloud-api'

import type { HomeSetCapabilitiesAta } from '../../types/index.mts'
import { HomeBaseMELCloudDevice } from '../../drivers/home-base-device.mts'

export class TestHomeDevice extends HomeBaseMELCloudDevice {
  public capabilityToDevice: Partial<
    Record<
      keyof HomeSetCapabilitiesAta,
      (value: never) => HomeAtaValues[keyof HomeAtaValues]
    >
  > = {}

  public readonly deviceToCapability: Partial<
    Record<string, (facade: HomeDeviceAtaFacade) => unknown>
  > = {}

  public readonly thermostatMode: Record<string, string> | null = null
}
