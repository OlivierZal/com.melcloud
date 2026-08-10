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

const optionValues = (select: HTMLSelectElement): string[] =>
  [...select.options].map(({ value }) => value)

const commit = (element: HTMLSelectElement, value: string): void => {
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
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
    // Whole degrees over the published range, plus the blank
    // "no instruction" entry.
    expect(getSelect('SetTemperature').options).toHaveLength(23)
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
    expect(getSelect('SetTemperature').value).toBe('22')
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
    getSelect('SetTemperature').value = '25'
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
    getSelect('SetTemperature').value = '25'
    await manager.setValues()

    expect(lastPutBody(harness)).toStrictEqual({ SetTemperature: 25 })
  })

  it('should raise the offered floor in a cooling mode', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    const temperature = getSelect('SetTemperature')

    expect(optionValues(temperature)).toContain('12')

    commit(temperature, '12')
    commit(getSelect('OperationMode'), '3')

    // Cooling raises the floor to the API's cooling minimum, and the
    // now-unofferable choice falls back to "no instruction" rather than
    // being sent as something the user never picked.
    expect(optionValues(temperature)).not.toContain('12')
    expect(optionValues(temperature).at(1)).toBe('16')
    expect(temperature.value).toBe('')
  })

  it('should keep a still-offered choice across a mode change', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    const temperature = getSelect('SetTemperature')
    commit(temperature, '25')
    commit(getSelect('OperationMode'), '3')

    expect(temperature.value).toBe('25')
  })

  it('should offer only the published range', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    const offered = optionValues(getSelect('SetTemperature')).slice(1)

    // The universal envelope: a group may mix models, and each device's
    // own per-mode limits narrow the write API-side.
    expect(offered.at(0)).toBe('10')
    expect(offered.at(-1)).toBe('31')
    expect(offered).not.toContain('9')
    expect(offered).not.toContain('32')
  })

  it('should offer the widest range without a mode control', async () => {
    const { manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /classic/capabilities/ata': [
          ['SetTemperature', { title: 'Temperature', type: 'number' }],
        ],
      },
    })
    await manager.fetchValues()

    // No mode to read: the floor stays the widest published one.
    expect(optionValues(getSelect('SetTemperature')).at(1)).toBe('10')
  })

  it('should stay quiet on a device without a temperature control', async () => {
    const { manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /classic/capabilities/ata': [
          ['Power', { title: 'Power', type: 'boolean' }],
          [
            'OperationMode',
            {
              title: 'Mode',
              type: 'enum',
              values: [{ id: '3', label: 'Cool' }],
            },
          ],
        ],
      },
    })
    await manager.fetchValues()

    // A mode change with nothing to rebuild must not throw.
    expect(() => {
      commit(getSelect('OperationMode'), '3')
    }).not.toThrow()
    expect(document.querySelector('#SetTemperature')).toBeNull()
  })

  it('should keep an off-grid device value selectable', async () => {
    const { manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /classic/zones/buildings/1/ata': {
          ...groupStateFixture(),
          SetTemperature: 22.5,
        },
      },
    })
    await manager.fetchValues()
    const temperature = getSelect('SetTemperature')

    // No step is published anywhere, so the grid is whole degrees — a
    // half degree set elsewhere must still show, and stay sendable.
    expect(temperature.value).toBe('22.5')
    expect(optionValues(temperature)).toContain('22.5')
  })

  it('should absorb an accepted write into the zone state', async () => {
    const { manager, ...harness } = await createManager()
    await manager.fetchValues()
    getSelect('SetTemperature').value = '25'
    await manager.setValues()
    // The known state took the write: re-sending the same form value
    // nets an empty body, so the gate cannot arm.
    getSelect('SetTemperature').value = '25'

    expect(
      getButtonDisabled('apply_values_melcloud') || lastPutBody(harness),
    ).toBe(true)
  })

  it('should restore the known state on refresh', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    getSelect('SetTemperature').value = '25'
    manager.displayValues()

    expect(getSelect('SetTemperature').value).toBe('22')
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
