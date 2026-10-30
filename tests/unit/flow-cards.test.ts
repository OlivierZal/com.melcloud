import { describe, expect, it } from 'vitest'

import { tagMappings as classicAtaTagMappings } from '../../types/classic-ata.mts'
import { tagMappings as classicAtwTagMappings } from '../../types/classic-atw.mts'
import { tagMappings as classicErvTagMappings } from '../../types/classic-erv.mts'
import { homeTagMappingsAta } from '../../types/home-ata.mts'
import { homeTagMappingsAtw } from '../../types/home-atw.mts'
import manifest from '../../app.json' with { type: 'json' }

interface ActionCard {
  readonly args: readonly { readonly type: string; readonly filter?: string }[]
  readonly id: string
}

// What each driver writes: an action card forwards its argument to the
// device's capability listener, which only a written capability has.
const WRITTEN_CAPABILITIES: Partial<Record<string, readonly string[]>> = {
  'home-melcloud': Object.keys(homeTagMappingsAta.set),
  'home-melcloud_atw': Object.keys(homeTagMappingsAtw.set),
  melcloud: Object.keys(classicAtaTagMappings.set),
  melcloud_atw: Object.keys(classicAtwTagMappings.set),
  melcloud_erv: Object.keys(classicErvTagMappings.set),
}

const byId = (left: string, right: string): number => left.localeCompare(right)

const capabilities = new Set(
  manifest.drivers.flatMap((driver) => driver.capabilities),
)

const actionCards: readonly ActionCard[] = manifest.flow.actions

const capabilityActions = actionCards
  .map(({ args, id }) => ({
    capability: id.replace(/_action$/v, ''),
    drivers:
      /driver_id=(?<drivers>[^&]*)/v
        .exec(args.find(({ type }) => type === 'device')?.filter ?? '')
        ?.groups?.drivers?.split('|') ?? [],
    id,
  }))
  .filter(({ capability }) => capabilities.has(capability))

// The app registers every capability action card once, from the
// manifest alone: that is sound only while each card's device filter
// names drivers that write its capability.
describe('capability action cards', () => {
  it('should know what every driver writes', () => {
    expect(Object.keys(WRITTEN_CAPABILITIES).toSorted(byId)).toStrictEqual(
      manifest.drivers.map(({ id }) => id).toSorted(byId),
    )
  })

  it.each(capabilityActions)(
    'should name only drivers writing $capability on $id',
    ({ capability, drivers }) => {
      expect(drivers).not.toHaveLength(0)
      expect(
        drivers.filter(
          (driver) =>
            WRITTEN_CAPABILITIES[driver]?.includes(capability) !== true,
        ),
      ).toStrictEqual([])
    },
  )
})
