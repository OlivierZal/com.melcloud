import { describe, expect, it } from 'vitest'
import libThermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json' with { type: 'json' }

import horizontalCapability from '../../.homeycompose/capabilities/horizontal.json' with { type: 'json' }
import verticalCapability from '../../.homeycompose/capabilities/vertical.json' with { type: 'json' }
import horizontalAction from '../../.homeycompose/flow/actions/horizontal_action.json' with { type: 'json' }
import verticalAction from '../../.homeycompose/flow/actions/vertical_action.json' with { type: 'json' }
import horizontalCondition from '../../.homeycompose/flow/conditions/horizontal_condition.json' with { type: 'json' }
import verticalCondition from '../../.homeycompose/flow/conditions/vertical_condition.json' with { type: 'json' }
import horizontalChanged from '../../.homeycompose/flow/triggers/horizontal_changed.json' with { type: 'json' }
import verticalChanged from '../../.homeycompose/flow/triggers/vertical_changed.json' with { type: 'json' }
import homeAtaCompose from '../../drivers/home-melcloud/driver.compose.json' with { type: 'json' }
import classicAtaCompose from '../../drivers/melcloud/driver.compose.json' with { type: 'json' }

// The companion of tests/unit/capability-definitions.test.ts: that one
// pins the vendored DEFINITIONS against node-homey-lib, this one pins
// the LABELS the app copies out of them. Nothing derives those copies at
// build time, so a homey-lib re-wording would leave the app spelling a
// value one way where Homey spells it another — on the same device page,
// since the ATA drivers ship `thermostat_mode` next to their own vane
// pickers.
//
// Membership states an INTENT, not a measurement: a row exists because
// the app site deliberately speaks homey-lib's wording. A label that
// merely collides in a few locales stays out, because pinning it would
// force an edit upstream never asked for. Kept out on that ground:
// `operational_state` (a state noun — "Heating"/"Cooling") against
// `thermostat_mode` (a mode verb — "Heat"/"Cool"), which meet only in
// ar/it/ko/pl/ru; the ATA driver settings' per-mode meter labels, whose
// siblings already decline homey-lib's wording; and the app's own
// `hot_water_mode` and `thermostat_mode` values, which keep their own
// Russian ("Авто") and are therefore the app's wording, not Homey's.
interface LabelSite {
  readonly json: unknown
  readonly path: string
  readonly source: string
}

const THERMOSTAT_AUTO: LabelSite = {
  json: libThermostatMode,
  path: 'values[0].title',
  source: 'thermostat_mode',
}

const THERMOSTAT_COOL: LabelSite = {
  json: libThermostatMode,
  path: 'values[2].title',
  source: 'thermostat_mode',
}

const borrowedFrom = (
  lib: LabelSite,
  apps: LabelSite[],
): { app: LabelSite; lib: LabelSite }[] => apps.map((app) => ({ app, lib }))

// `horizontal` and `vertical` are the app's own capabilities: homey-lib
// declares no vane capability, so their `auto` position is the one value
// that can borrow, and it borrows the whole localized map — in the
// capability, in each flow card repeating the dropdown, and in the
// trigger token's example. The two ATA drivers re-declare Homey's
// `thermostat_mode` to add the MELCloud-only modes and keep Homey's
// wording for `cool`; `driver-compose.test.ts` keeps those two blocks
// byte-identical to each other, this pins what they both say.
const BORROWED_LABELS = [
  ...borrowedFrom(THERMOSTAT_AUTO, [
    {
      json: horizontalCapability,
      path: 'values[0].title',
      source: '.homeycompose/capabilities/horizontal.json',
    },
    {
      json: verticalCapability,
      path: 'values[0].title',
      source: '.homeycompose/capabilities/vertical.json',
    },
    {
      json: horizontalAction,
      path: 'args[1].values[0].title',
      source: '.homeycompose/flow/actions/horizontal_action.json',
    },
    {
      json: verticalAction,
      path: 'args[1].values[0].title',
      source: '.homeycompose/flow/actions/vertical_action.json',
    },
    {
      json: horizontalCondition,
      path: 'args[1].values[0].title',
      source: '.homeycompose/flow/conditions/horizontal_condition.json',
    },
    {
      json: verticalCondition,
      path: 'args[1].values[0].title',
      source: '.homeycompose/flow/conditions/vertical_condition.json',
    },
    {
      json: horizontalChanged,
      path: 'tokens[0].example',
      source: '.homeycompose/flow/triggers/horizontal_changed.json',
    },
    {
      json: verticalChanged,
      path: 'tokens[0].example',
      source: '.homeycompose/flow/triggers/vertical_changed.json',
    },
  ]),
  ...borrowedFrom(THERMOSTAT_COOL, [
    {
      json: classicAtaCompose,
      path: 'capabilitiesOptions.thermostat_mode.values[1].title',
      source: 'drivers/melcloud/driver.compose.json',
    },
    {
      json: homeAtaCompose,
      path: 'capabilitiesOptions.thermostat_mode.values[1].title',
      source: 'drivers/home-melcloud/driver.compose.json',
    },
  ]),
]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const resolve = ({ json, path }: LabelSite): unknown => {
  const keys = path.replaceAll('[', '.').replaceAll(']', '').split('.')
  let node: unknown = json
  for (const key of keys) {
    node = isRecord(node) ? node[key] : undefined
  }
  return node
}

const readLabels = (site: LabelSite): Record<string, string> => {
  const node = resolve(site)
  const entries = Object.entries(isRecord(node) ? node : {})
  const labels: Record<string, string> = {}
  for (const [locale, wording] of entries) {
    if (typeof wording === 'string') {
      labels[locale] = wording
    }
  }
  return labels
}

// One entry per diverging locale, each carrying the remedy: the app
// label follows homey-lib, so the app file is what moves.
const findWordingBreaches = ({
  app,
  lib,
}: {
  app: LabelSite
  lib: LabelSite
}): string[] => {
  const appLabels = readLabels(app)
  const libLabels = Object.entries(readLabels(lib))
  const breaches: string[] = []
  for (const [locale, wording] of libLabels) {
    if (appLabels[locale] !== wording) {
      breaches.push(
        `${app.source} ${app.path} [${locale}] says ${JSON.stringify(appLabels[locale])} where node-homey-lib ${lib.source} ${lib.path} says ${JSON.stringify(wording)}: adopt the upstream wording in the app file and revisit this label's other locales — never edit vendor/capabilities to make this pass.`,
      )
    }
  }
  return breaches
}

describe('borrowed capability labels', () => {
  it.each(BORROWED_LABELS)(
    'should spell $app.source $app.path as homey-lib $lib.source $lib.path',
    (row) => {
      expect.assertions(2)

      // A mistyped homey-lib path would otherwise compare nothing.
      expect(Object.keys(readLabels(row.lib))).not.toStrictEqual([])

      expect(findWordingBreaches(row)).toStrictEqual([])
    },
  )
})
