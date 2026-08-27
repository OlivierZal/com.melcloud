// @vitest-environment happy-dom
// @vitest-environment-options {"settings": {"disableCSSFileLoading": true, "disableJavaScriptFileLoading": true, "navigation": {"disableMainFrameNavigation": true}}}

import type { HomeDeviceZone } from '@olivierzal/melcloud-api'
import { getFieldset, getInput, getSelect } from '@olivierzal/homey-kit/dom'
import { beforeEach, describe, expect, it } from 'vitest'

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
    expect(optionValues(getSelect('Power'))).toHaveLength(3)
    expect(optionValues(getSelect('OperationMode'))).toHaveLength(6)
    // The manifest grid (10→31 by 0.5) plus that blank entry.
    expect(optionValues(getSelect('SetTemperature'))).toHaveLength(44)
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
        'GET /targets/homeBuildings_b_1/ata': {},
        'GET /targets/homeDevices_ata_1/ata': {},
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

    expect(paths).toContain('GET /targets/homeBuildings_b_1/ata')
    expect(paths).toContain('GET /targets/homeDevices_ata_1/ata')
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

  it('should offer the temperature grid warmest first', async () => {
    await createManager()
    // Deliberate product decision, pinned so it is not "corrected" to
    // ascending: the picker reads like the thermometer it sets, warmest
    // at the top. Index 0 is the blank "no instruction" entry.
    const [blank, ...degrees] = optionValues(getSelect('SetTemperature'))

    expect(blank).toBe('')
    expect(degrees.at(0)).toBe('31')
    expect(degrees.at(-1)).toBe('10')
    // Half degrees survive the ordering, and the run is monotonic.
    expect(degrees).toContain('23.5')
    expect(degrees.map(Number)).toStrictEqual(
      degrees.map(Number).toSorted((first, second) => second - first),
    )
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
    // Warmest first, so the raised floor is the LAST option offered.
    expect(optionValues(temperature).at(-1)).toBe('16')
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
    // own per-mode limits narrow the write API-side. Warmest first.
    expect(offered.at(0)).toBe('31')
    expect(offered.at(-1)).toBe('10')
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

    // No mode to read: the floor stays the widest published one, and
    // warmest-first puts it last.
    expect(optionValues(getSelect('SetTemperature')).at(-1)).toBe('10')
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

  it('should offer the half degrees MELCloud accepts', async () => {
    const { manager } = await createManager()
    await manager.fetchValues()
    const offered = optionValues(getSelect('SetTemperature'))

    // The step is read from the manifest the app serves, never invented
    // here: a whole-degree grid would forbid what the old input mangled.
    expect(offered).toContain('23.5')
    expect(offered).toContain('10.5')
    expect(offered).toContain('30.5')
  })

  it('should label the temperatures in the page language', async () => {
    document.documentElement.lang = 'fr'
    const { manager } = await createManager()
    await manager.fetchValues()
    const half = [...getSelect('SetTemperature').options].find(
      ({ value }) => value === '23.5',
    )

    // A comma in French (with the locale's own spacing before the unit),
    // while the value stays the wire form.
    expect(half?.textContent).toMatch(/^23,5\s*°C$/v)
    expect(half?.value).toBe('23.5')
  })

  it('should format on the runtime default when no language is set', async () => {
    document.documentElement.lang = ''
    const { manager } = await createManager()
    await manager.fetchValues()
    const half = [...getSelect('SetTemperature').options].find(
      ({ value }) => value === '23.5',
    )

    // An empty tag is not a valid locale: the picker still renders.
    expect(half?.textContent).toContain('23')
  })

  it('should fall back to whole degrees without a declared grid', async () => {
    const { manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /classic/capabilities/ata': [
          ['SetTemperature', { title: 'Temperature', type: 'number' }],
        ],
      },
    })
    await manager.fetchValues()
    const offered = optionValues(getSelect('SetTemperature'))

    expect(offered).not.toContain('23.5')
    // Warmest first: the blank entry, then 31 down to 10.
    expect(offered.at(1)).toBe('31')
    expect(offered.at(-1)).toBe('10')
  })

  it('should keep an off-grid device value selectable', async () => {
    const { manager } = await createManager({
      routes: {
        ...widgetRoutes(),
        'GET /targets/buildings_1/ata': {
          ...groupStateFixture(),
          SetTemperature: 22.3,
        },
      },
    })
    await manager.fetchValues()
    const temperature = getSelect('SetTemperature')

    // A tenth set elsewhere sits off the declared half-degree grid: it
    // must still show, and stay sendable.
    expect(temperature.value).toBe('22.3')
    expect(optionValues(temperature)).toContain('22.3')
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

  it('should keep an in-progress edit across a real-time sync', async () => {
    const routes = widgetRoutes()
    const { manager } = await createManager({ routes })
    // The zone starts without a fan-speed reading: the control opens
    // blank, and blank-vs-absent must read as pristine, not as an edit.
    routes['GET /targets/buildings_1/ata'] = {
      OperationMode: 1,
      Power: true,
      SetTemperature: 22,
    }
    await manager.fetchValues()
    commit(getSelect('SetTemperature'), '25')
    const fanSpeed = getInput('FanSpeed')
    fanSpeed.value = '5'
    fanSpeed.dispatchEvent(new Event('change', { bubbles: true }))
    routes['GET /targets/buildings_1/ata'] = {
      ...groupStateFixture(),
      Power: false,
    }
    await manager.fetchValuesKeepingEdits()

    // The untouched control follows the stream; the edits — the picker
    // and the free input alike — stay the user's, so pressing Update
    // would still carry them.
    expect(getSelect('Power').value).toBe('false')
    expect(getSelect('SetTemperature').value).toBe('25')
    expect(getInput('FanSpeed').value).toBe('5')
    expect(getButtonDisabled('apply_values_melcloud')).toBe(false)
  })

  it('should grey Update when the zone catches up with the edit', async () => {
    const routes = widgetRoutes()
    const { manager } = await createManager({ routes })
    await manager.fetchValues()
    commit(getSelect('SetTemperature'), '25')
    routes['GET /targets/buildings_1/ata'] = {
      ...groupStateFixture(),
      SetTemperature: 25,
    }
    await manager.fetchValuesKeepingEdits()

    // The edit became a no-op: nothing to send, so the gate cannot arm.
    expect(getSelect('SetTemperature').value).toBe('25')
    expect(getButtonDisabled('apply_values_melcloud')).toBe(true)

    // Caught up means released: the control follows the stream again.
    routes['GET /targets/buildings_1/ata'] = {
      ...groupStateFixture(),
      SetTemperature: 23,
    }
    await manager.fetchValuesKeepingEdits()

    expect(getSelect('SetTemperature').value).toBe('23')
  })

  it('should blank an edit the incoming mode pushed off the grid', async () => {
    const routes = widgetRoutes()
    const { manager } = await createManager({ routes })
    await manager.fetchValues()
    commit(getSelect('SetTemperature'), '12')
    routes['GET /targets/buildings_1/ata'] = {
      ...groupStateFixture(),
      OperationMode: 3,
    }
    await manager.fetchValuesKeepingEdits()

    // The synced cooling mode raised the floor past the edit: a value
    // no request could carry blanks to "no instruction", and an empty
    // body cannot arm.
    expect(getSelect('OperationMode').value).toBe('3')
    expect(getSelect('SetTemperature').value).toBe('')
    expect(optionValues(getSelect('SetTemperature'))).not.toContain('12')
    expect(getButtonDisabled('apply_values_melcloud')).toBe(true)
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
