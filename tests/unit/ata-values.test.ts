// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import { getFieldset, getInput, getSelect } from '@olivierzal/homey-kit/dom'
import { beforeEach, describe, expect, it } from 'vitest'

import type { HomeDeviceZone } from '../../types/zone.mts'
import { AtaValueManager } from '../../widgets/ata-group-setting/public/ata-values.mts'
import {
  type WidgetHarness,
  type WidgetHarnessOptions,
  createWidgetHomey,
  groupStateFixture,
  loadWidgetPage,
  widgetRoutes,
} from '../ata-group-harness.ts'
import { mock } from '../helpers.ts'

interface ManagerHarness extends WidgetHarness {
  readonly manager: AtaValueManager
}

const classicZones = (): HomeDeviceZone[] => [
  mock<HomeDeviceZone>({ id: 1, level: 0, model: 'buildings', name: 'Home' }),
  mock<HomeDeviceZone>({ id: 11, level: 1, model: 'devices', name: 'Living' }),
]

const createManager = async (
  options: WidgetHarnessOptions = {},
): Promise<ManagerHarness> => {
  const harness = createWidgetHomey(options)
  const manager = new AtaValueManager(
    harness.homey,
    getFieldset('values_melcloud'),
    getSelect('zones'),
  )
  await manager.fetchCapabilities()
  manager.createAtaFormControls()
  manager.populateZoneOptions(classicZones())
  return { ...harness, manager }
}

const lastPutBody = (harness: WidgetHarness): unknown =>
  harness.api.mock.calls.findLast(([method]) => method === 'PUT')?.[2]

describe('ata value manager', () => {
  beforeEach(() => {
    loadWidgetPage()
  })

  it('should build one control per mappable capability', async () => {
    await createManager()
    const fieldset = getFieldset('values_melcloud')

    // Each select opens on the blank "no instruction" option.
    expect(getSelect('Power').options).toHaveLength(3)
    expect(getSelect('OperationMode').options).toHaveLength(6)
    expect(getInput('SetTemperature').min).toBe('10')
    expect(getInput('SetTemperature').max).toBe('31')
    expect(getInput('FanSpeed').min).toBe('')
    // The unmappable capability yields no control and no label.
    expect(fieldset.querySelector('#SilentMode')).toBeNull()
    expect([...fieldset.querySelectorAll('label')]).toHaveLength(4)
  })

  it('should fetch and display the zone state', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()

    expect(getSelect('Power').value).toBe('true')
    expect(getSelect('OperationMode').value).toBe('1')
    expect(getInput('SetTemperature').value).toBe('22')
    expect(getInput('FanSpeed').value).toBe('3')
  })

  it('should route each zone kind to its state endpoint', async () => {
    const { api, manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /home/buildings/b_1/ata': {},
        'GET /home/devices/ata_1/ata': {},
      },
    })
    const zone = getSelect('zones')
    for (const value of ['homeBuildings_b_1', 'homeDevices_ata_1']) {
      const option = document.createElement('option')
      option.value = value
      zone.append(option)
    }
    for (const value of ['homeBuildings_b_1', 'homeDevices_ata_1']) {
      zone.value = value
      // eslint-disable-next-line no-await-in-loop -- sequential by design: one endpoint probe at a time
      await manager.fetchValues()
    }
    const paths = harnessPaths(api)

    expect(paths).toContain('GET /home/buildings/b_1/ata')
    expect(paths).toContain('GET /home/devices/ata_1/ata')
  })

  it('should apply a matching default zone and skip the rest', async () => {
    const { manager } = await createManager()
    const zone = getSelect('zones')
    manager.applyDefaultZone(null)

    expect(zone.value).toBe('buildings_1')

    manager.applyDefaultZone(mock<HomeDeviceZone>({ id: 11, model: 'devices' }))

    expect(zone.value).toBe('devices_11')

    manager.applyDefaultZone(
      mock<HomeDeviceZone>({ id: 'missing', model: 'homeDevices' }),
    )

    expect(zone.value).toBe('devices_11')
  })

  it('should keep an empty populate call harmless', async () => {
    const { manager } = await createManager()
    const count = getSelect('zones').options.length
    manager.populateZoneOptions()

    expect(getSelect('zones').options).toHaveLength(count)
  })

  it('should send only the actionable divergence', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    // Same as the zone state → filtered; emptied → no instruction.
    getSelect('OperationMode').value = '1'
    getInput('FanSpeed').value = ''
    getInput('SetTemperature').value = '25'
    getSelect('Power').value = 'true'
    await manager.setValues()

    expect(lastPutBody(harness)).toStrictEqual({ SetTemperature: 25 })
  })

  it('should skip a foreign control in the body', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    const rogue = document.createElement('input')
    rogue.id = 'NotACapability'
    rogue.value = '7'
    getFieldset('values_melcloud').append(rogue)
    getInput('SetTemperature').value = '25'
    await manager.setValues()

    expect(lastPutBody(harness)).toStrictEqual({ SetTemperature: 25 })
  })

  it('should clamp the temperature to the mode floor', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    getSelect('OperationMode').value = '3'
    getInput('SetTemperature').value = '12'
    await manager.setValues()

    // Cooling raises the floor to the API's cooling minimum.
    expect(lastPutBody(harness)).toStrictEqual({
      OperationMode: 3,
      SetTemperature: 16,
    })
  })

  it('should clamp the temperature to the manifest bounds', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    getInput('SetTemperature').value = '5'
    await manager.setValues()

    expect(lastPutBody(harness)).toStrictEqual({ SetTemperature: 10 })

    getInput('SetTemperature').value = '40'
    await manager.setValues()

    expect(lastPutBody(harness)).toStrictEqual({ SetTemperature: 31 })
  })

  it('should reject a non-finite temperature before the wire', async () => {
    const { api, manager } = await createManager()
    await manager.fetchValues()
    // Valid floating-point syntax the control keeps, overflowing to
    // Infinity — the one non-finite value a number input can carry.
    getInput('SetTemperature').value = '1e999'

    await expect(manager.setValues()).rejects.toThrow('Invalid number')
    expect(harnessPaths(api)).not.toContain(
      'PUT /classic/zones/buildings/1/ata',
    )
  })

  it('should absorb an accepted write into the zone state', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    getInput('SetTemperature').value = '25'
    await manager.setValues()
    // The known state took the write: re-sending the same form value
    // nets an empty body, so the gate cannot arm.
    getInput('SetTemperature').value = '25'

    expect(
      getButtonDisabled('apply_values_melcloud') || lastPutBody(harness),
    ).toBe(true)
  })

  it('should restore the known state on refresh', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    getInput('SetTemperature').value = '25'
    manager.displayValues()

    expect(getInput('SetTemperature').value).toBe('22')
  })

  it('should skip a value slot without a control', async () => {
    const { manager } = await createManager()
    // A rogue non-control carrying a capability id must not take the
    // sync write.
    const rogue = document.createElement('div')
    rogue.id = 'FanSpeed'
    getInput('FanSpeed').remove()
    getFieldset('values_melcloud').append(rogue)

    await expect(manager.fetchValues()).resolves.toStrictEqual(
      groupStateFixture(),
    )
  })
})

const harnessPaths = (api: WidgetHarness['api']): string[] =>
  api.mock.calls.map(([method, path]) => `${method} ${path}`)

const getButtonDisabled = (id: string): boolean => {
  const element = document.querySelector(`#${CSS.escape(id)}`)
  return element instanceof HTMLButtonElement && element.disabled
}
