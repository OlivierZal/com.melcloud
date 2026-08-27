// `Classic.GroupState` is the CROSS-FAMILY group vocabulary, not a
// Classic-only branch: both families' ATA facades implement `getGroup`
// and `updateGroupState` against it, the Home ones projecting their own
// dialect at their boundary. So every value this widget reads or writes
// — `OperationMode` included, always Classic-numbered — carries one
// spelling whatever API backs the target, and the constants below apply
// to both (`ClassicTemperature` is documented universal across ATA
// models). Even the address is family-neutral: the option value IS the
// `/targets/:targetId/ata` targetId, resolved app-side.
import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  type HTMLValueElement,
  booleanOptions,
  createInput,
  createOption,
  createSelect,
  getButton,
  parseFormValue,
} from '@olivierzal/homey-kit/dom'
import { type DirtyGate, createDirtyGate } from '@olivierzal/homey-kit/webview'
import {
  ClassicTemperature,
  classicCoolModes,
} from '@olivierzal/melcloud-api/constants'

import type { DriverCapabilitiesOptions } from '../../../types/driver-settings.mts'
import type { AtaGroupSettingWidgetSettings } from '../../../types/widgets.mts'
import { appendFormControl, populateZoneOptions } from '../../../public/dom.mts'
import {
  type Homey,
  homeyApiGet,
  homeyApiPut,
} from '../../../public/widget.mts'
import { type PickerZone, getZoneId } from '../../../public/zones.mts'

// The generated controls are styled by element selectors in
// `styles/layout.css` (Homey design tokens) — no utility classes needed,
// so the shared builders run without their class hooks.
const elementTypes = new Set(['boolean', 'enum'])

// ── Value processing ──

// Safe widening: lets the runtime `number` select value be probed without
// asserting it down to ClassicOperationMode.
const coolModeNumbers: ReadonlySet<number> = classicCoolModes

// `SetTemperature` is the only control built with bounds (see
// #createAtaControl), so the bounded-number strategy IS the temperature
// clamp — no id dispatch. Cooling modes raise the floor to the API's
// cooling minimum.
// The target temperature is a SELECT of the grid the driver manifest
// declares, not a free-text number: a phone keyboard let a decimal
// separator through and the widget sent the truncated integer
// ("23," → 23), which a picker cannot express at all — and MELCloud
// works in half degrees, so a whole-degree picker would forbid what the
// old input merely mangled.
//
// The step and the bounds are READ AT THE SOURCE: they ride on the
// capability options the app serves straight from the manifest
// (`target_temperature`: min 10, max 31, step 0.5). Only the
// cooling floor comes from melcloud-api (`ClassicTemperature.coolingMin`)
// — it is mode-dependent, which no manifest can express. A capability
// arriving without a grid falls back to the library's universal
// envelope, so a manifest that loses its options degrades to whole
// degrees instead of rendering nothing.
const FALLBACK_TEMPERATURE_STEP = 1

// The floor follows the mode the user CHOSE: an untouched (or mixed)
// mode leaves the device's own mode in place, so the widest range is
// the only honest offer — as does a device with no mode control.
const getTemperatureMin = (declaredMin: number): number => {
  const mode = document.querySelector('#OperationMode')
  return mode instanceof HTMLSelectElement &&
    coolModeNumbers.has(Number(mode.value))
    ? ClassicTemperature.coolingMin
    : declaredMin
}

// Labels follow the page language (a comma in French); the option VALUE
// stays the wire form, so what is sent never depends on the locale.
const formatTemperature = (degrees: number): string => {
  // An empty `lang` is not a valid tag: hand `undefined` over so the
  // runtime default applies instead of throwing mid-render.
  const { lang } = document.documentElement
  const formatter = new Intl.NumberFormat(lang === '' ? undefined : lang, {
    maximumFractionDigits: 1,
    style: 'unit',
    unit: 'celsius',
  })
  return formatter.format(degrees)
}

// The declared grid for the active floor, plus `current` when the device
// sits off it: a value with no option would blank the picker and
// silently drop what the device holds.
const temperatureOptions = (
  { max, min, step }: { max: number; min: number; step: number },
  current: number | null,
): { id: string; label: string }[] => {
  const values = new Set<number>()
  // Stepped by index: adding a fractional step repeatedly drifts.
  for (let index = 0; min + index * step <= max; index++) {
    values.add(Number((min + index * step).toFixed(1)))
  }
  if (current !== null && current >= min && current <= max) {
    values.add(current)
  }
  // Warmest first: the picker reads like the thermometer it sets, and
  // the order is pinned by test so it is not "corrected" to ascending.
  return [...values]
    .toSorted((first, second) => second - first)
    .map((degrees) => ({
      id: String(degrees),
      label: formatTemperature(degrees),
    }))
}

// The one state route for every target: the `${model}_${id}` option
// value is the targetId verbatim (the settings routes' addressing), so
// no family branch remains in the path.
const getAtaStatePath = (value: string): string => `/targets/${value}/ata`

// ── AtaValueManager class ──

export class AtaValueManager {
  #ataCapabilities: [keyof Classic.GroupState, DriverCapabilitiesOptions][] = []

  readonly #ataValues: HTMLFieldSetElement

  #defaultAtaValues: Partial<Record<keyof Classic.GroupState, null>> = {}

  // Owns Update (greyed until the form diverges from its saved baseline)
  // and Refresh (greyed during a request alone).
  readonly #dirtyGate: DirtyGate

  readonly #homey: Homey

  readonly #zone: HTMLSelectElement

  readonly #zoneMapping: Partial<Record<string, Partial<Classic.GroupState>>> =
    {}

  public constructor(
    homey: Homey,
    ataValuesElement: HTMLFieldSetElement,
    zoneElement: HTMLSelectElement,
  ) {
    this.#homey = homey
    this.#ataValues = ataValuesElement
    this.#zone = zoneElement
    // Update starts greyed even when no zone resolves and the first
    // fetch never runs. Arming goes through `isActionable`: an emptied
    // field means "no instruction" and a value equal to the zone's known
    // state is filtered out, so Update arms only when the request would
    // actually carry something.
    this.#dirtyGate = createDirtyGate({
      applyElement: getButton('apply_values_melcloud'),
      fieldsetElements: [ataValuesElement],
      refreshElements: [getButton('refresh_values_melcloud')],
      isActionable: (): boolean =>
        Object.keys(this.#buildAtaValuesBody()).length > 0,
    })
  }

  public applyDefaultZone(
    defaultZone: AtaGroupSettingWidgetSettings['default_zone'],
  ): void {
    if (defaultZone === null) {
      return
    }

    const { id, model } = defaultZone
    const value = getZoneId(id, model)
    if (
      document.querySelector(`#zones option[value="${CSS.escape(value)}"]`) !==
      null
    ) {
      this.#zone.value = value
    }
  }

  public createAtaFormControls(): void {
    const formControls: HTMLValueElement[] = []
    for (const [id, { title, type, values }] of this.#ataCapabilities) {
      const formControl = this.#createAtaControl({ id, type, values })
      if (formControl !== null) {
        formControls.push(formControl)
      }
      appendFormControl(this.#ataValues, { formControl, title })
    }
    this.#wireTemperatureRange()
    // Every control feeds the dirty check so Update tracks edits live; the
    // freshly built (still empty) controls are the pristine baseline.
    this.#dirtyGate.wire(formControls)
    this.#dirtyGate.markSaved()
  }

  public displayValues(): void {
    this.#syncAtaValues()
    this.#dirtyGate.markSaved()
  }

  public async fetchCapabilities(): Promise<void> {
    this.#ataCapabilities = await homeyApiGet<
      [keyof Classic.GroupState, DriverCapabilitiesOptions][]
    >(this.#homey, '/classic/capabilities/ata')
    this.#defaultAtaValues = Object.fromEntries(
      this.#ataCapabilities.map(([ataKey]) => [ataKey, null]),
    )
  }

  // The FULL sync: initial load, zone switch and Refresh all mean "show
  // me the zone as it stands", so every control takes the server state,
  // edits included — an edit is a zone-scoped statement, not a portable
  // one. The real-time path is `fetchValuesKeepingEdits`.
  public async fetchValues(): Promise<Classic.GroupState> {
    const values = await homeyApiGet<Classic.GroupState>(
      this.#homey,
      getAtaStatePath(this.#zone.value),
    )
    this.#updateZoneMapping({ ...this.#defaultAtaValues, ...values })
    this.#syncAtaValues()
    // `runBusy`'s generation guard keeps this from releasing a save
    // that a live PUT still owns.
    this.#dirtyGate.markSaved()
    return values
  }

  // The real-time sync (`deviceupdate`): a control still showing what
  // the zone held follows the stream; one the user moved keeps the
  // edit. No baseline moves — the gate runs in predicate mode, so
  // `recompute` re-judges the kept edits against the zone's NEW state:
  // Update greys exactly when every edit was caught up (a no-op button
  // must not arm) and re-arms the moment one diverges again.
  public async fetchValuesKeepingEdits(): Promise<Classic.GroupState> {
    const previous = { ...this.#zoneMapping[this.#zone.value] }
    const values = await homeyApiGet<Classic.GroupState>(
      this.#homey,
      getAtaStatePath(this.#zone.value),
    )
    this.#updateZoneMapping({ ...this.#defaultAtaValues, ...values })
    this.#syncPristineAtaValues(previous)
    this.#dirtyGate.recompute()
    return values
  }

  public populateZoneOptions(zones: PickerZone[] = []): void {
    populateZoneOptions(this.#zone, zones)
  }

  public async setValues(): Promise<void> {
    // The gate's `isActionable` arms Update only on a non-empty body —
    // never re-derive that invariant here.
    await this.#dirtyGate.runBusy(async () => {
      const body = this.#buildAtaValuesBody()
      await homeyApiPut(
        this.#homey,
        getAtaStatePath(this.#zone.value),
        body satisfies Classic.GroupState,
      )
      // The zone's known state absorbs the accepted write immediately:
      // the debounced `deviceupdate` refetch confirms it later, but
      // until then the body filter (and so `isActionable`) must judge
      // against what the server now holds, not the pre-write state.
      this.#updateZoneMapping(body)
      // New pristine baseline is the just-applied form. A rejected PUT
      // throws before this, so the edit stays dirty for a retry.
      this.#dirtyGate.markSaved()
    })
  }

  #buildAtaValuesBody(): Classic.GroupState {
    return Object.fromEntries(
      [...this.#ataValues.querySelectorAll<HTMLValueElement>('input, select')]
        .filter(
          ({ id, value }) =>
            this.#isGroupAtaState(id) &&
            ![
              '',
              this.#zoneMapping[this.#zone.value]?.[id]?.toString(),
            ].includes(value),
        )
        .map((element) => [element.id, parseFormValue(element)]),
    )
  }

  #createAtaControl({
    id,
    type,
    values,
  }: {
    id: string
    type: string
    values?: readonly { id: string; label: string }[] | undefined
  }): HTMLValueElement | null {
    if (elementTypes.has(type)) {
      return createSelect(
        id,
        values ?? booleanOptions((key) => this.#homey.__(key)),
      )
    }
    if (id === 'SetTemperature') {
      return createSelect(id, temperatureOptions(this.#temperatureGrid(), null))
    }
    if (type === 'number') {
      return createInput({ id, type })
    }
    return null
  }

  #isGroupAtaState(value: string): value is keyof Classic.GroupState {
    return Object.hasOwn(this.#defaultAtaValues, value)
  }

  // Rebuilds the temperature picker for the active floor, keeping the
  // wanted value when the new range still offers it (an out-of-range one
  // falls back to blank, i.e. "no instruction").
  #refreshTemperatureOptions(wanted: string): void {
    const select = document.querySelector('#SetTemperature')
    if (!(select instanceof HTMLSelectElement)) {
      return
    }
    const current = this.#zoneMapping[this.#zone.value]?.SetTemperature
    const options = temperatureOptions(
      this.#temperatureGrid(),
      typeof current === 'number' ? current : null,
    )
    select.replaceChildren()
    createOption(select, { id: '', label: '' })
    for (const option of options) {
      createOption(select, option)
    }
    select.value = wanted
  }

  #syncAtaValues(): void {
    for (const [ataKey] of this.#ataCapabilities) {
      this.#updateAtaValue(ataKey)
    }
  }

  // `SetTemperature` runs LAST so its grid rebuild reads the mode this
  // same sync settled (a programmatic mode write fires no `change`
  // event for the rebuild wiring to catch). A kept edit the new floor
  // no longer offers blanks to "no instruction": the form never
  // displays a value no request could carry.
  #syncPristineAtaValues(previous: Partial<Classic.GroupState>): void {
    const ataKeys = this.#ataCapabilities
      .map(([ataKey]) => ataKey)
      .toSorted(
        (first, second) =>
          Number(first === 'SetTemperature') -
          Number(second === 'SetTemperature'),
      )
    for (const ataKey of ataKeys) {
      const control = this.#ataValues.querySelector(`#${CSS.escape(ataKey)}`)
      if (
        !(control instanceof HTMLInputElement) &&
        !(control instanceof HTMLSelectElement)
      ) {
        continue
      }
      if (control.value === (previous[ataKey]?.toString() ?? '')) {
        this.#updateAtaValue(ataKey)
      } else if (ataKey === 'SetTemperature') {
        this.#refreshTemperatureOptions(control.value)
      }
    }
  }

  // The grid the app served for `SetTemperature`, with the mode-dependent
  // floor applied. A capability without declared bounds degrades to the
  // library's universal envelope in whole degrees rather than rendering
  // an empty picker.
  #temperatureGrid(): { max: number; min: number; step: number } {
    const declared = this.#ataCapabilities.find(
      ([key]) => key === 'SetTemperature',
    )?.[1]
    const min = declared?.min ?? ClassicTemperature.min
    return {
      max: declared?.max ?? ClassicTemperature.max,
      min: getTemperatureMin(min),
      step: declared?.step ?? FALLBACK_TEMPERATURE_STEP,
    }
  }

  #updateAtaValue(id: keyof Classic.GroupState): void {
    const ataValue = this.#ataValues.querySelector(`#${CSS.escape(id)}`)
    if (
      ataValue !== null &&
      (ataValue instanceof HTMLInputElement ||
        ataValue instanceof HTMLSelectElement)
    ) {
      const value = this.#zoneMapping[this.#zone.value]?.[id]?.toString() ?? ''
      // The picker must offer the device's own value before taking it —
      // a half degree set elsewhere would otherwise blank the control.
      if (id === 'SetTemperature') {
        this.#refreshTemperatureOptions(value)
        return
      }
      ataValue.value = value
    }
  }

  #updateZoneMapping(data: Partial<Classic.GroupState>): void {
    const { value } = this.#zone
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }

  // The offered temperatures depend on the chosen mode, so the picker is
  // rebuilt whenever that choice moves.
  #wireTemperatureRange(): void {
    const mode = document.querySelector('#OperationMode')
    if (mode instanceof HTMLSelectElement) {
      mode.addEventListener('change', () => {
        const temperature = document.querySelector('#SetTemperature')
        this.#refreshTemperatureOptions(
          temperature instanceof HTMLSelectElement ? temperature.value : '',
        )
      })
    }
  }
}
