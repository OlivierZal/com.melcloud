import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  type HTMLValueElement,
  booleanOptions,
  createInput,
  createSelect,
  getButton,
  getSelect,
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
import {
  type PickerZone,
  getHomeBuildingId,
  getHomeDeviceId,
  getZoneId,
  getZonePath,
  isHomeBuildingValue,
  isHomeDeviceValue,
} from '../../../public/zones.mts'

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
const clampTemperature = ({ max, min, value }: HTMLInputElement): number => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    throw new TypeError('Invalid number')
  }
  const activeMin = coolModeNumbers.has(
    Number(getSelect('OperationMode').value),
  )
    ? ClassicTemperature.coolingMin
    : Number(min)
  return Math.min(Math.max(numberValue, activeMin), Number(max))
}

// Routes a `${model}_${id}` option value to its state endpoint.
const getAtaStatePath = (value: string): string => {
  if (isHomeBuildingValue(value)) {
    return `/home/buildings/${encodeURIComponent(getHomeBuildingId(value))}/ata`
  }
  return isHomeDeviceValue(value)
    ? `/home/devices/${encodeURIComponent(getHomeDeviceId(value))}/ata`
    : `/classic/zones/${getZonePath(value)}/ata`
}

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

  public async fetchValues(): Promise<Classic.GroupState> {
    const values = await homeyApiGet<Classic.GroupState>(
      this.#homey,
      getAtaStatePath(this.#zone.value),
    )
    this.#updateZoneMapping({ ...this.#defaultAtaValues, ...values })
    this.#syncAtaValues()
    // The incoming server state becomes the new baseline (a background
    // re-fetch mid-edit re-snapshots here); `runBusy`'s generation guard
    // keeps this from releasing a save that a live PUT still owns.
    this.#dirtyGate.markSaved()
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
        .map((element) => [
          element.id,
          parseFormValue(element, clampTemperature),
        ]),
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
    if (type === 'number') {
      return createInput({
        id,
        max: id === 'SetTemperature' ? ClassicTemperature.max : undefined,
        min: id === 'SetTemperature' ? ClassicTemperature.min : undefined,
        type,
      })
    }
    return null
  }

  #isGroupAtaState(value: string): value is keyof Classic.GroupState {
    return Object.hasOwn(this.#defaultAtaValues, value)
  }

  #syncAtaValues(): void {
    for (const [ataKey] of this.#ataCapabilities) {
      this.#updateAtaValue(ataKey)
    }
  }

  #updateAtaValue(id: keyof Classic.GroupState): void {
    const ataValue = this.#ataValues.querySelector(`#${CSS.escape(id)}`)
    if (
      ataValue !== null &&
      (ataValue instanceof HTMLInputElement ||
        ataValue instanceof HTMLSelectElement)
    ) {
      ataValue.value =
        this.#zoneMapping[this.#zone.value]?.[id]?.toString() ?? ''
    }
  }

  #updateZoneMapping(data: Partial<Classic.GroupState>): void {
    const { value } = this.#zone
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
}
