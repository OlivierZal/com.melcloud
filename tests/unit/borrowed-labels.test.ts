import { describe, expect, it } from 'vitest'
import libThermostatMode from 'homey-lib/assets/capability/capabilities/thermostat_mode.json' with { type: 'json' }

import horizontalCapability from '../../.homeycompose/capabilities/horizontal.json' with { type: 'json' }
import verticalCapability from '../../.homeycompose/capabilities/vertical.json' with { type: 'json' }
import horizontalAction from '../../.homeycompose/flow/actions/horizontal_action.json' with { type: 'json' }
import verticalAction from '../../.homeycompose/flow/actions/vertical_action.json' with { type: 'json' }
import horizontalCondition from '../../.homeycompose/flow/conditions/horizontal_condition.json' with { type: 'json' }
import thermostatZone2Condition from '../../.homeycompose/flow/conditions/thermostat_mode.zone2_condition.json' with { type: 'json' }
import verticalCondition from '../../.homeycompose/flow/conditions/vertical_condition.json' with { type: 'json' }
import horizontalChanged from '../../.homeycompose/flow/triggers/horizontal_changed.json' with { type: 'json' }
import thermostatZone2Changed from '../../.homeycompose/flow/triggers/thermostat_mode.zone2_changed.json' with { type: 'json' }
import verticalChanged from '../../.homeycompose/flow/triggers/vertical_changed.json' with { type: 'json' }
import homeAtaCompose from '../../drivers/home-melcloud/driver.compose.json' with { type: 'json' }
import classicAtaCompose from '../../drivers/melcloud/driver.compose.json' with { type: 'json' }

// The companion of tests/unit/capability-definitions.test.ts: that one
// pins the vendored DEFINITIONS against node-homey-lib, this one pins
// the LABELS the app takes from them. Nothing derives those at build
// time, so a homey-lib re-wording would leave the app spelling a value
// one way where Homey spells it another — on the same device page, since
// the ATA drivers ship `thermostat_mode` next to their own vane pickers,
// and in the same flow-card list, since the ATW drivers ship the app's
// zone-2 cards next to Homey's own.
//
// The app leans on that wording in TWO shapes, one table each. A COPY is
// byte-equal to its homey-lib label, so `BORROWED_LABELS` compares whole
// strings. A DERIVATIVE only embeds homey-lib's term inside a sentence of
// the app's own ("… in zone 2", "- zone 2", its own `!{{…|…}}`
// inflection), so nothing is byte-equal and `DERIVED_WORDINGS` pins the
// TERM instead — see its own note below.
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
//
// When a row breaks, the APP string follows: adopt the new wording
// there — reasoning about the sentence, not substituting a substring,
// where the locale's grammar demands it — and revisit that label's
// other locales; or, when the site no longer borrows homey-lib's
// wording, delete the row, since membership states an intent. Never
// edit vendor/capabilities to make a row pass.
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

const THERMOSTAT_CAPABILITY: LabelSite = {
  json: libThermostatMode,
  path: 'title',
  source: 'thermostat_mode',
}

const THERMOSTAT_CONDITION: LabelSite = {
  json: libThermostatMode,
  path: '$flow.conditions[0].title',
  source: 'thermostat_mode',
}

const THERMOSTAT_TRIGGER: LabelSite = {
  json: libThermostatMode,
  path: '$flow.triggers[0].title',
  source: 'thermostat_mode',
}

// The noun as homey-lib's CARDS spell it. It is not always the noun the
// capability header spells: 2.52.1 re-worded the nl cards to
// "thermostaatstand" and the ru ones to "Режим работы термостата" while
// leaving both capability titles alone, and the it cards say "modalità
// del termostato" where the header drops the "del".
const CARD_TERMS = {
  ar: 'وضع الثرموستات',
  da: 'termostattilstand',
  de: 'thermostat-modus',
  en: 'thermostat mode',
  es: 'modo del termostato',
  fr: 'mode du thermostat',
  it: 'modalità del termostato',
  ko: '온도조절기 모드',
  nl: 'thermostaatstand',
  no: 'termostatmodus',
  pl: 'tryb termostatu',
  ru: 'режим работы термостата',
  sv: 'termostatläge',
}

// The noun as the capability HEADER spells it — what Homey shows on the
// device page and on the tag its own capability trigger exposes. Where
// the two diverge, the zone-2 token rightly keeps the header's noun
// ("Thermostaatmodus - zone 2").
const CAPABILITY_TERMS = {
  ...CARD_TERMS,
  it: 'modalità termostato',
  nl: 'thermostaatmodus',
  ru: 'режим термостата',
}

// The ATW drivers ship `thermostat_mode.zone2` beside Homey's own
// `thermostat_mode`, so the app's zone-2 cards stand next to Homey's in
// one flow-card list and must name the concept with Homey's word. Which
// homey-lib label each one follows is a per-site judgement, and it is
// the `lib` column that records it: a card TITLE follows the card of the
// same kind (Homey's condition card is what the app's condition card
// sits beside), while the trigger's TOKEN title follows the capability
// header, because a token is a tag name — Homey titles the zone-1 tag
// from the header, and the app's other zone-2 tags ("Operational state -
// zone 2", "Temperature - zone 2") are built the same way.
//
// Out by the same judgement: the zone-2 ACTION card, whose every locale
// names "the mode in zone 2" rather than the thermostat mode. It embeds
// no homey-lib term, so it has none to follow — a row for it would have
// to invent an upstream wording the app never spoke.
const DERIVED_WORDINGS = [
  {
    app: {
      json: thermostatZone2Changed,
      path: 'title',
      source: '.homeycompose/flow/triggers/thermostat_mode.zone2_changed.json',
    },
    lib: THERMOSTAT_TRIGGER,
    terms: CARD_TERMS,
  },
  {
    app: {
      json: thermostatZone2Changed,
      path: 'tokens[0].title',
      source: '.homeycompose/flow/triggers/thermostat_mode.zone2_changed.json',
    },
    lib: THERMOSTAT_CAPABILITY,
    terms: CAPABILITY_TERMS,
  },
  {
    app: {
      json: thermostatZone2Condition,
      path: 'title',
      source:
        '.homeycompose/flow/conditions/thermostat_mode.zone2_condition.json',
    },
    lib: THERMOSTAT_CONDITION,
    terms: CARD_TERMS,
  },
  {
    app: {
      json: thermostatZone2Condition,
      path: 'titleFormatted',
      source:
        '.homeycompose/flow/conditions/thermostat_mode.zone2_condition.json',
    },
    lib: THERMOSTAT_CONDITION,
    terms: CARD_TERMS,
  },
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

// One entry per diverging locale, each carrying both exits: the app
// label follows homey-lib, so the app file is what moves — unless the
// label stopped borrowing, in which case the row goes.
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
        `${app.source} ${app.path} [${locale}] says ${JSON.stringify(appLabels[locale])} where node-homey-lib ${lib.source} ${lib.path} says ${JSON.stringify(wording)}: adopt the upstream wording in the app file and revisit this label's other locales, or, if this label no longer borrows homey-lib's wording, delete its row: membership states an intent — never edit vendor/capabilities to make this pass.`,
      )
    }
  }
  return breaches
}

const listLocales = (labels: Record<string, unknown>): string =>
  Object.keys(labels)
    .toSorted((one, other) => one.localeCompare(other))
    .join(', ')

const speaks = (wording: string | undefined, term: string): boolean =>
  wording?.toLowerCase().includes(term.toLowerCase()) ?? false

// A derivative cannot be compared whole, so the row's TERM carries the
// comparison: it is pinned to sit inside BOTH sides. Against homey-lib it
// is the tripwire — the day upstream re-words the noun, the term stops
// being found there and the row fails with the new wording in hand.
// Against the app it holds the adoption, so a later edit cannot quietly
// walk the app's sentence away from Homey's word. A term is a whole
// localized noun phrase, authored per locale as an intent: it cannot hold
// by accident the way a bare `includes` of a common word would, and it
// cannot keep matching a phrase upstream has rewritten.
const findTermBreaches = ({
  app,
  lib,
  terms,
}: {
  app: LabelSite
  lib: LabelSite
  terms: Record<string, string>
}): string[] => {
  const appLabels = readLabels(app)
  const libLabels = readLabels(lib)
  const breaches: string[] = []
  const pinned = listLocales(terms)
  const localized = listLocales(libLabels)
  if (pinned !== localized) {
    breaches.push(
      `${app.source} ${app.path} pins a term for [${pinned}] where node-homey-lib ${lib.source} ${lib.path} is localized into [${localized}]: translate the app string into the locales upstream gained, or drop the ones it lost, then re-pin the terms here.`,
    )
  }
  for (const [locale, term] of Object.entries(terms)) {
    if (!speaks(libLabels[locale], term)) {
      breaches.push(
        `node-homey-lib ${lib.source} ${lib.path} [${locale}] says ${JSON.stringify(libLabels[locale])}, which no longer contains the term ${JSON.stringify(term)} that ${app.source} ${app.path} embeds: upstream re-worded it — carry the new noun into the app string, keeping the app's own additions around it, then re-pin the term here.`,
      )
    }
    if (!speaks(appLabels[locale], term)) {
      breaches.push(
        `${app.source} ${app.path} [${locale}] says ${JSON.stringify(appLabels[locale])}, which does not contain node-homey-lib's term ${JSON.stringify(term)} from ${lib.source} ${lib.path}: speak the upstream noun and keep the app's own additions around it — never edit vendor/capabilities to make this pass.`,
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

describe('derived flow-card wording', () => {
  it.each(DERIVED_WORDINGS)(
    'should embed homey-lib $lib.source $lib.path in $app.source $app.path',
    (row) => {
      expect.assertions(2)

      // A mistyped homey-lib path would otherwise pin nothing.
      expect(Object.keys(readLabels(row.lib))).not.toStrictEqual([])

      expect(findTermBreaches(row)).toStrictEqual([])
    },
  )
})
