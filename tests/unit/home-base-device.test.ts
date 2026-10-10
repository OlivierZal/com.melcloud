import type * as Home from '@olivierzal/melcloud-api/home'
import type HomeyModule from 'homey'
import { NotFoundError } from '@olivierzal/homey-kit'
import {
  type InteropModule,
  assertDefined,
  mock,
  settleDetached,
} from '@olivierzal/homey-kit/testing'
import { EntityNotFoundError } from '@olivierzal/melcloud-api'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BaseMELCloudDevice } from '../../drivers/base-device.mts'
import {
  createCapabilityListenerCallbackGetter,
  testEnsureDeviceNull,
  testPostUpdateSync,
  testSetValuesErrorHandling,
  testThermostatModeOff,
} from '../device-descriptors.ts'
import {
  type TestHomeDevice,
  createTestHomeDevice,
} from './home-base-device-test-device.ts'

const {
  getHomeFacadeMock,
  getSettingMock,
  isRegistryPopulatedMock,
  realtimeMock,
  registerMultipleCapabilityListenerMock,
  setValuesMock,
  superErrorMock,
  superLogMock,
  superSetWarningMock,
} = vi.hoisted(() => ({
  getHomeFacadeMock: vi.fn<(id: string) => unknown>(),
  getSettingMock: vi.fn<(key: string) => unknown>(),
  isRegistryPopulatedMock: vi.fn<(api: string) => boolean>(),
  realtimeMock: vi.fn<(event: string, data: unknown) => void>(),
  registerMultipleCapabilityListenerMock:
    vi.fn<
      (
        capabilities: string[],
        listener: (values: Record<string, unknown>) => Promise<void>,
        debounce: number,
      ) => void
    >(),
  setValuesMock: vi.fn<(values: Record<string, unknown>) => Promise<boolean>>(),
  superErrorMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
  superLogMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
  superSetWarningMock: vi.fn<(...args: readonly unknown[]) => unknown>(),
}))

const facadeState = { isAvailable: true, isPoweredOn: true }

const requiredCapabilities = vi.hoisted(() => [
  'measure_temperature',
  'onoff',
  'target_temperature',
  'thermostat_mode',
])

const createMockFacade = (): Home.DeviceAtaFacade =>
  mock<Home.DeviceAtaFacade>({
    capabilities: { hasAutomaticFanSpeed: true, numberOfFanSpeeds: 5 },
    updateValues: setValuesMock,
    get isAvailable(): boolean {
      return facadeState.isAvailable
    },
    get operationMode(): string {
      return 'Heat'
    },
    get power(): boolean {
      return facadeState.isPoweredOn
    },
    get roomTemperature(): number {
      return 21
    },
    get setTemperature(): number {
      return 22
    },
  })

vi.mock(import('homey'), async () => {
  const { createMockDeviceClass } = await import('../helpers.ts')
  const { mock: mockModule } = await import('@olivierzal/homey-kit/testing')
  return mockModule<InteropModule<typeof HomeyModule>>({
    default: {
      Device: createMockDeviceClass({
        overrides: {
          driver: {
            manifest: { capabilities: requiredCapabilities },
            tagMappings: {
              energy: {},
              get: {},
              list: {},
              set: {
                fan_speed: 'setFanSpeed',
                horizontal: 'vaneHorizontalDirection',
                onoff: 'power',
                target_temperature: 'setTemperature',
                thermostat_mode: 'operationMode',
                vertical: 'vaneVerticalDirection',
              },
            },
            getCapabilitiesOptions: (): Record<string, unknown> => ({}),
            getRequiredCapabilities: (): string[] => requiredCapabilities,
          },
          getData: vi
            .fn<() => { id: string }>()
            .mockReturnValue({ id: 'device-1' }),
          getSetting: getSettingMock,
          homey: {
            __: vi
              .fn<(key: string) => string>()
              .mockImplementation((key: string) => key),
            api: { realtime: realtimeMock },
            app: {
              getHomeFacade: getHomeFacadeMock,
              isRegistryPopulated: isRegistryPopulatedMock,
            },
            clearTimeout: vi.fn<(timer: NodeJS.Timeout | null) => void>(),
            setTimeout:
              vi.fn<(callback: () => void, ms: number) => NodeJS.Timeout>(),
          },
          registerMultipleCapabilityListener:
            registerMultipleCapabilityListenerMock,
        },
        superMocks: {
          error: superErrorMock,
          log: superLogMock,
          setWarning: superSetWarningMock,
        },
      }),
    },
  })
})

const getCapabilityListenerCallback = createCapabilityListenerCallbackGetter(
  registerMultipleCapabilityListenerMock,
)

type CachedFacade = NonNullable<TestHomeDevice['exposedFacade']>

// What a cached facade over a pruned registry entry does on every read.
const throwPruned = (): never => {
  throw new EntityNotFoundError('Device', { entityId: 'device-1' })
}

// One healthy sync caches the facade and lets init's detached pass (its
// own sync, the energy-report scheduling) settle, so the warning and log
// sequences a test reads afterwards are its own. Answers the cached
// facade for the test to break.
const primeDevice = async (
  primedDevice: TestHomeDevice,
): Promise<CachedFacade> => {
  await primedDevice.syncFromDevice()
  await settleDetached()
  superErrorMock.mockClear()
  superLogMock.mockClear()
  superSetWarningMock.mockClear()
  vi.mocked(primedDevice.setAvailable).mockClear()
  vi.mocked(primedDevice.setCapabilityValue).mockClear()
  const facade = primedDevice.exposedFacade
  assertDefined(facade)
  return facade
}

// Makes the cached facade fail as a pruned registry entry does —
// permanently, or once when the unit must recover on the next sync.
const pruneFacade = (
  facade: CachedFacade,
  { shouldRecover = false } = {},
): void => {
  const availability = vi.spyOn(facade, 'isAvailable', 'get')
  if (shouldRecover) {
    availability.mockImplementationOnce(throwPruned)
  } else {
    availability.mockImplementation(throwPruned)
  }
}

// A device whose temperature converter can be switched between a mapped
// reading and `undefined` mid-test.
const createTogglingDevice = (): {
  mapping: { isMappable: boolean }
  togglingDevice: TestHomeDevice
} => {
  const mapping = { isMappable: true }
  const togglingDevice = createTestHomeDevice()
  Object.defineProperty(togglingDevice, 'deviceToCapability', {
    value: {
      measure_temperature: (): number | undefined =>
        mapping.isMappable ? 21 : undefined,
    },
  })
  return { mapping, togglingDevice }
}

describe(BaseMELCloudDevice, () => {
  let device: TestHomeDevice

  // The hold/release tests read the full call sequences of the warning
  // IPC and the log, so both start empty for every test. The registry
  // reads empty by default — the boot race — and the prune tests fill it.
  beforeEach(() => {
    facadeState.isAvailable = true
    facadeState.isPoweredOn = true
    getHomeFacadeMock.mockReturnValue(createMockFacade())
    isRegistryPopulatedMock.mockReturnValue(false)
    setValuesMock.mockResolvedValue(true)
    superErrorMock.mockClear()
    superLogMock.mockClear()
    superSetWarningMock.mockClear()
    device = createTestHomeDevice()
  })

  describe('device identifier', () => {
    it('should return the device id from getData', () => {
      expect(device.id).toBe('device-1')
    })
  })

  describe('initialization', () => {
    it('should clear warning, register listeners, and sync from device', async () => {
      await device.onInit()

      expect(superSetWarningMock).toHaveBeenCalledWith(null)
      expect(registerMultipleCapabilityListenerMock).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Function),
        expect.any(Number),
      )
    })

    it('should remove capabilities not in required list during init', async () => {
      vi.spyOn(device, 'getCapabilities').mockReturnValue([
        'measure_temperature',
        'onoff',
        'obsolete_capability',
      ])
      const spy = vi.spyOn(device, 'removeCapability')
      await device.onInit()

      expect(spy).toHaveBeenCalledWith('obsolete_capability')
    })
  })

  describe('device synchronization', () => {
    it('should set capability values from facade', async () => {
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
      expect(device.setCapabilityValue).toHaveBeenCalledWith('onoff', true)
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'target_temperature',
        22,
      )
    })

    it('should set thermostat_mode to operationMode when power is on', async () => {
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'thermostat_mode',
        'Heat',
      )
    })

    it('should mark the device unavailable when MELCloud reports it disconnected', async () => {
      facadeState.isAvailable = false
      await device.syncFromDevice()

      expect(device.setUnavailable).toHaveBeenCalledWith('errors.unitOffline')
      expect(device.setAvailable).not.toHaveBeenCalled()
    })

    it('should mark the device available again when the unit reconnects', async () => {
      facadeState.isAvailable = false
      await device.syncFromDevice()
      facadeState.isAvailable = true
      await device.syncFromDevice()

      expect(device.setAvailable).toHaveBeenCalledWith()
    })

    it('should propagate unexpected sync errors untouched', async () => {
      const facade = createMockFacade()
      vi.spyOn(facade, 'isAvailable', 'get').mockImplementation(() => {
        throw new Error('boom')
      })
      getHomeFacadeMock.mockReturnValue(facade)

      await expect(device.syncFromDevice()).rejects.toThrow('boom')
    })

    // A unit the registry no longer resolves (on Home an entry the strict
    // `/context` parse refused, on either dialect a unit gone from the
    // account) is a LASTING condition: the warning stays on the tile,
    // with no trailing `null` — the one-shot toast would flash it for an
    // instant and leave the frozen values unexplained. The error names
    // the id, not the cause, so the log gets it once, on the hold: the
    // SDK prunes in silence.
    it('should hold a warning and log the cause once when the registry drops the device', async () => {
      pruneFacade(await primeDevice(device))
      await device.syncFromDevice()

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
      ])
      expect(superErrorMock.mock.calls).toStrictEqual([
        [
          'Test device',
          '-',
          'Unit unreadable, warning held:',
          expect.any(EntityNotFoundError),
        ],
      ])
      expect(device.setUnavailable).not.toHaveBeenCalled()
    })

    it('should not re-hold or re-log the warning the tile already shows', async () => {
      pruneFacade(await primeDevice(device))
      await device.syncFromDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock).toHaveBeenCalledTimes(1)
      expect(superErrorMock).toHaveBeenCalledTimes(1)
    })

    // Syncs overlap in practice (init's detached pass, a post-write sync,
    // the app-level cycle): the hold is recorded before its IPC call so
    // the second sync skips it.
    it('should hold once when two syncs overlap on a pruned unit', async () => {
      pruneFacade(await primeDevice(device))
      await Promise.all([device.syncFromDevice(), device.syncFromDevice()])

      expect(superSetWarningMock).toHaveBeenCalledTimes(1)
    })

    // Hold on the first prune, release on the first success: no threshold
    // either way — a one-minute bubble is honest, and a flapping entry is
    // a wire fact for the SDK's drift streak to log.
    it('should release the held warning once on the first readable sync', async () => {
      pruneFacade(await primeDevice(device), { shouldRecover: true })
      await device.syncFromDevice()
      await device.syncFromDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
        [null],
      ])
      expect(superLogMock.mock.calls).toStrictEqual([
        ['Test device', '-', 'Unit readable again, warning released'],
      ])
      expect(device.setAvailable).toHaveBeenCalledTimes(2)
    })

    it('should not touch the warning or the log on a readable sync when nothing is held', async () => {
      await primeDevice(device)
      await device.syncFromDevice()

      expect(superSetWarningMock).not.toHaveBeenCalled()
      expect(superLogMock).not.toHaveBeenCalled()
    })

    // The warning is IPC: a failure is logged, never thrown, and rolls
    // the hold back so the next sync retries it; the cause line waits
    // for the hold that lands.
    it('should log a failed hold and retry it on the next sync', async () => {
      pruneFacade(await primeDevice(device))
      superSetWarningMock.mockImplementationOnce(() => {
        throw new Error('IPC failed')
      })
      await device.syncFromDevice()
      await device.syncFromDevice()

      expect(superErrorMock.mock.calls).toStrictEqual([
        [
          'Test device',
          '-',
          'Failed to update the device warning:',
          expect.any(Error),
        ],
        [
          'Test device',
          '-',
          'Unit unreadable, warning held:',
          expect.any(EntityNotFoundError),
        ],
      ])
      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
        ['errors.unitUnreadable'],
      ])
    })

    it('should keep the hold recorded and retry a failed release', async () => {
      pruneFacade(await primeDevice(device), { shouldRecover: true })
      await device.syncFromDevice()
      superSetWarningMock.mockImplementationOnce(() => {
        throw new Error('IPC failed')
      })
      await device.syncFromDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
        [null],
        [null],
      ])
      expect(superLogMock.mock.calls).toStrictEqual([
        ['Test device', '-', 'Unit readable again, warning released'],
      ])
    })

    // A write on an unreadable unit fails the same way and raises the
    // one-shot toast: its reset lands on the held message, never on
    // `null`, or the explanation would vanish until the unit recovers.
    it('should return to the held warning after a toast', async () => {
      pruneFacade(await primeDevice(device))
      await device.syncFromDevice()
      await device.setWarning(new Error('Write failed'))

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
        ['Write failed'],
        ['errors.unitUnreadable'],
      ])
    })

    it('should set thermostat_mode to off when power is off', async () => {
      facadeState.isPoweredOn = false
      getHomeFacadeMock.mockReturnValue(createMockFacade())
      await device.syncFromDevice()

      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'thermostat_mode',
        'off',
      )
    })

    it('should not set capability values when getHomeFacade throws', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new Error('Device not found')
      })
      await device.syncFromDevice()

      expect(device.setCapabilityValue).not.toHaveBeenCalled()
    })

    // A lookup failing while the registry has listed NOTHING yet is the
    // boot race — over within a minute of start, not a prune — so the
    // one-shot toast stays: shown and cleared in the same call.
    it('should toast a failed lookup while the registry lists no unit yet', async () => {
      getHomeFacadeMock.mockImplementation(() => {
        throw new NotFoundError('Device not found')
      })
      await device.syncFromDevice()

      expect(isRegistryPopulatedMock).toHaveBeenCalledWith('home')
      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['Device not found'],
        [null],
      ])
    })

    // The same lookup failing on a registry that lists OTHER units is a
    // prune the facade cache did not survive — an app restart a day after
    // the prune, a unit never cached — and the same lasting condition as
    // the cached-facade read above: held once, no trailing `null`, the
    // cause logged once.
    it('should hold the warning when the lookup fails on a populated registry', async () => {
      isRegistryPopulatedMock.mockReturnValue(true)
      getHomeFacadeMock.mockImplementation(() => {
        throw new NotFoundError('Device not found')
      })
      await device.syncFromDevice()
      await device.syncFromDevice()

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
      ])
      expect(superErrorMock.mock.calls).toStrictEqual([
        [
          'Test device',
          '-',
          'Unit unreadable, warning held:',
          expect.any(NotFoundError),
        ],
      ])
      expect(device.setUnavailable).not.toHaveBeenCalled()
    })

    // The first lookup that resolves caches the facade and runs init,
    // whose detached pass syncs too: the hold lifts once, whichever of
    // the overlapping syncs reaches the release first, and the closing
    // line is written once (init's own energy-report lines follow it).
    it('should release the lookup hold once when the registry lists the unit again', async () => {
      isRegistryPopulatedMock.mockReturnValue(true)
      getHomeFacadeMock.mockImplementationOnce(() => {
        throw new NotFoundError('Device not found')
      })
      await device.syncFromDevice()
      await device.syncFromDevice()
      await settleDetached()
      await device.syncFromDevice()

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
        [null],
      ])
      expect(
        superLogMock.mock.calls.filter((call) =>
          call.includes('Unit readable again, warning released'),
        ),
      ).toHaveLength(1)
      expect(device.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
    })

    it('should skip capabilities the device does not have', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.syncFromDevice()

      expect(device.setCapabilityValue).not.toHaveBeenCalled()
    })

    it('should use deviceToCapability converter when present', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'deviceToCapability', {
        value: {
          measure_temperature: (facade: Home.DeviceAtaFacade): number =>
            facade.roomTemperature * 2,
        },
      })
      await customDevice.syncFromDevice()

      expect(customDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        42,
      )
    })

    // The library types the Home enums as closed vocabularies but passes
    // the wire through unenforced, so a member the BFF adds or renames
    // reaches a converter that has no entry for it. `undefined` must
    // leave the capability alone — Home has no raw tag to fall back on,
    // unlike the Classic leg. The line is written once per transition,
    // not per sync: a stuck capability used to log 1,440 times a day at
    // Home's one-minute cadence, while the skip itself still happens on
    // every sync.
    it('should skip the write and report a value it cannot map once', async () => {
      const { mapping, togglingDevice } = createTogglingDevice()
      await primeDevice(togglingDevice)
      const error = vi.spyOn(togglingDevice, 'error')
      mapping.isMappable = false
      await togglingDevice.syncFromDevice()
      await togglingDevice.syncFromDevice()

      expect(togglingDevice.setCapabilityValue).not.toHaveBeenCalled()
      expect(error.mock.calls).toStrictEqual([
        [
          'Unmapped device value, capability left as is:',
          'measure_temperature',
        ],
      ])
    })

    it('should log once when the value maps again, then write it', async () => {
      const { mapping, togglingDevice } = createTogglingDevice()
      await primeDevice(togglingDevice)
      const log = vi.spyOn(togglingDevice, 'log')
      mapping.isMappable = false
      await togglingDevice.syncFromDevice()
      mapping.isMappable = true
      await togglingDevice.syncFromDevice()
      await togglingDevice.syncFromDevice()

      expect(log.mock.calls).toStrictEqual([
        ['Device value mapped again:', 'measure_temperature'],
      ])
      expect(togglingDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        21,
      )
    })

    // `null` is Homey's own "unknown" and must keep landing: the ATW
    // zone-2 reads rely on it to clear a capability on a single-zone
    // unit, so the skip above tests `undefined` and never nullish.
    it('should still write a null, which clears the capability', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'deviceToCapability', {
        value: { measure_temperature: (): null => null },
      })
      await customDevice.syncFromDevice()

      expect(customDevice.setCapabilityValue).toHaveBeenCalledWith(
        'measure_temperature',
        null,
      )
    })
  })

  // Two lasting conditions can hold at once — an unreadable unit and a
  // failing energy report, or the two reports of one device — and a
  // device has ONE bubble: it shows the highest-priority held reason, and
  // releasing one reason uncovers the next instead of clearing the tile.
  describe('held warning reasons', () => {
    it('should keep the bubble while another reason with the same wording is held', async () => {
      await device.holdWarning('regularEnergyReports')
      await device.holdWarning('totalEnergyReports')
      await device.releaseWarning('regularEnergyReports')

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.energyReportsFailing'],
      ])

      await device.releaseWarning('totalEnergyReports')

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.energyReportsFailing'],
        [null],
      ])
    })

    it('should show the unreadable warning over a failing report and uncover it on release', async () => {
      await device.holdWarning('regularEnergyReports')
      await device.holdWarning('unreadable')
      await device.releaseWarning('unreadable')
      await device.releaseWarning('regularEnergyReports')

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.energyReportsFailing'],
        ['errors.unitUnreadable'],
        ['errors.energyReportsFailing'],
        [null],
      ])
    })

    // A reason behind a higher-priority one is recorded without IPC, and
    // the hold still answers true: the condition is new to the record,
    // which is what the caller's one log line reports.
    it('should record a report reason behind the unreadable warning without IPC', async () => {
      await device.holdWarning('unreadable')

      await expect(device.holdWarning('regularEnergyReports')).resolves.toBe(
        true,
      )
      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.unitUnreadable'],
      ])
    })

    it('should answer false for a reason already held or never held', async () => {
      await device.holdWarning('unreadable')

      await expect(device.holdWarning('unreadable')).resolves.toBe(false)
      await expect(device.releaseWarning('regularEnergyReports')).resolves.toBe(
        false,
      )
      expect(superSetWarningMock).toHaveBeenCalledTimes(1)
    })

    it('should return a toast to the highest-priority held reason', async () => {
      await device.holdWarning('totalEnergyReports')
      await device.holdWarning('unreadable')
      await device.setWarning(new Error('Write failed'))

      expect(superSetWarningMock.mock.calls).toStrictEqual([
        ['errors.energyReportsFailing'],
        ['errors.unitUnreadable'],
        ['Write failed'],
        ['errors.unitUnreadable'],
      ])
    })
  })

  describe('capability change handling', () => {
    it('should call updateValues when capability values are set', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ power: true })
    })

    it('should use capabilityToDevice converter when present', async () => {
      const customDevice = createTestHomeDevice()
      Object.defineProperty(customDevice, 'capabilityToDevice', {
        value: {
          fan_speed: (): Home.AtaValues[keyof Home.AtaValues] => 'Auto',
        },
        writable: true,
      })
      await customDevice.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ fan_speed: 3 })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ setFanSpeed: 'Auto' }),
      )
    })

    it('should not modify thermostat_mode when thermostat does not support off', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      await callback({ thermostat_mode: 'off' })

      expect(setValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ operationMode: 'off' }),
      )
    })

    it('should not call updateValues when no homeValues keys remain', async () => {
      vi.spyOn(device, 'hasCapability').mockReturnValue(false)
      await device.onInit()
      setValuesMock.mockClear()
      const callback = getCapabilityListenerCallback()
      await callback({})

      expect(setValuesMock).not.toHaveBeenCalled()
    })

    it('should use cached facade when available', async () => {
      await device.onInit()
      const callback = getCapabilityListenerCallback()
      getHomeFacadeMock.mockClear()
      await callback({ onoff: true })

      expect(getHomeFacadeMock).not.toHaveBeenCalled()
    })

    it('should fetch facade when not cached', async () => {
      getHomeFacadeMock.mockImplementationOnce(() => {
        throw new Error('not found')
      })
      const freshDevice = createTestHomeDevice()
      await freshDevice.onInit()
      getHomeFacadeMock.mockReturnValue(createMockFacade())
      const callback = getCapabilityListenerCallback()
      await callback({ onoff: true })

      expect(setValuesMock).toHaveBeenCalledWith({ power: true })
    })
  })

  testPostUpdateSync(() => device, getCapabilityListenerCallback, {
    argsPrefix: ['Test device', '-'],
    get: () => superErrorMock,
  })

  testThermostatModeOff(createTestHomeDevice, getCapabilityListenerCallback, {
    expectedValues: {
      nonOff: { operationMode: 'heat', power: true },
      off: { power: false },
    },
    setValuesMock,
  })

  testEnsureDeviceNull(createTestHomeDevice, getCapabilityListenerCallback, {
    facadeMock: getHomeFacadeMock,
    setValuesMock,
  })

  testSetValuesErrorHandling(() => device, getCapabilityListenerCallback, {
    setValuesMock,
    superSetWarningMock,
  })

  describe('facade access', () => {
    it('should expose facade via protected getter after sync', async () => {
      await device.syncFromDevice()

      expect(device.exposedFacade).toBeDefined()
    })

    it('should be undefined before sync', () => {
      expect(device.exposedFacade).toBeUndefined()
    })
  })

  describe('capability seams', () => {
    it('should return no capabilities options before the facade is cached', () => {
      const seams = device as unknown as {
        getCapabilitiesOptions: () => Partial<Record<string, unknown>>
        getRequiredCapabilities: () => string[]
      }

      expect(seams.getCapabilitiesOptions()).toStrictEqual({})
      expect(seams.getRequiredCapabilities()).toStrictEqual([])
    })
  })

  describe('prefixed logging', () => {
    it('should prepend the device name to logs', () => {
      device.log('synced')

      expect(superLogMock).toHaveBeenCalledWith('Test device', '-', 'synced')
    })

    it('should prepend the device name to error logs', () => {
      device.error('failed')

      expect(superErrorMock).toHaveBeenCalledWith('Test device', '-', 'failed')
    })
  })
})
