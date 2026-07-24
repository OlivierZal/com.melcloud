import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  ClassicTemperature,
  classicCoolModes,
} from '@olivierzal/melcloud-api/constants'

import type { Settings } from '../../../types/device-settings.mts'
import type { DriverCapabilitiesOptions } from '../../../types/driver-settings.mts'
import type { AtaGroupSettingWidgetSettings } from '../../../types/widgets.mts'
import type { HomeBuildingZone, HomeDeviceZone } from '../../../types/zone.mts'
import {
  type HTMLValueElement,
  booleanStrings,
  configureNumericInput,
  createOption,
  getButton,
  getSelect,
} from '../../../public/dom.mts'
import {
  type Homey,
  homeyApiGet,
  homeyApiPut,
} from '../../../public/homey-api.mts'
import { getZoneId, getZoneName } from '../../../public/zones.mts'

type TargetZone = Classic.Zone | HomeBuildingZone | HomeDeviceZone

// ── DOM helpers ──

const elementTypes = new Set(['boolean', 'enum'])

// ── DOM creation helpers ──

// Labels, inputs and selects are styled by element selectors in
// `styles/layout.css` (Homey design tokens) — no utility classes needed.
const createLabel = (
  formControl: HTMLValueElement,
  text: string,
): HTMLLabelElement => {
  const label = document.createElement('label')
  label.htmlFor = formControl.id
  label.textContent = text
  label.append(formControl)
  return label
}

const appendFormControl = (
  parent: HTMLElement,
  {
    formControl,
    title,
  }: { formControl: HTMLValueElement | null; title: string },
): void => {
  if (formControl !== null) {
    parent.append(createLabel(formControl, title))
  }
}

const createInput = ({
  id,
  max,
  min,
  placeholder,
  type,
  value,
}: {
  id: string
  type: string
  max?: number | undefined
  min?: number | undefined
  placeholder?: string
  value?: string
}): HTMLInputElement => {
  const input = document.createElement('input')
  input.id = id
  input.value = value ?? ''
  input.type = type
  configureNumericInput(input, { max, min })
  if (placeholder !== undefined) {
    input.placeholder = placeholder
  }
  return input
}

const createSelect = (
  homey: Homey,
  id: string,
  values?: readonly { id: string; label: string }[],
): HTMLSelectElement => {
  const select = document.createElement('select')
  select.id = id
  for (const option of [
    { id: '', label: '' },
    ...(values ??
      booleanStrings.map((value) => ({
        id: value,
        label: homey.__(`settings.boolean.${value}`),
      }))),
  ]) {
    createOption(select, option)
  }
  return select
}

// ── Value processing ──

// Safe widening: lets the runtime `number` select value be probed without
// asserting it down to ClassicOperationMode.
const coolModeNumbers: ReadonlySet<number> = classicCoolModes

const getCoolingAdjustedMin = (id: string, min: string): string =>
  (
    id === 'SetTemperature' &&
    coolModeNumbers.has(Number(getSelect('OperationMode').value))
  ) ?
    String(ClassicTemperature.cooling_min)
  : min

const clampNumericInput = ({
  id,
  max,
  min,
  value,
}: HTMLInputElement): number => {
  const numberValue = Number(value)
  const newMin = Number(getCoolingAdjustedMin(id, min))
  const newMax = Number(max)
  if (!Number.isFinite(numberValue)) {
    throw new TypeError('Invalid number')
  }
  return Math.min(Math.max(numberValue, newMin), newMax)
}

const parseFormValue = (
  element: HTMLValueElement,
): Settings[keyof Settings] => {
  if (element.value !== '') {
    if (element.type === 'checkbox') {
      return element.indeterminate ? null : element.checked
    }
    if (element.type === 'number' && element.min !== '' && element.max !== '') {
      return clampNumericInput(element)
    }
    if (booleanStrings.includes(element.value)) {
      return element.value === 'true'
    }
    const numberValue = Number(element.value)
    return Number.isFinite(numberValue) ? numberValue : element.value
  }
  return null
}

const getSubzones = (zone: TargetZone): TargetZone[] => [
  ...('devices' in zone ? zone.devices : []),
  ...('areas' in zone ? zone.areas : []),
  ...('floors' in zone ? zone.floors : []),
]

// Routes a `${model}_${id}` option value to its state endpoint. Split at the
// FIRST underscore only: Home ids may themselves contain underscores.
const getAtaStatePath = (value: string): string => {
  const separatorIndex = value.indexOf('_')
  const model = value.slice(0, separatorIndex)
  const id = value.slice(separatorIndex + 1)
  if (model === 'homeBuildings') {
    return `/home/buildings/${encodeURIComponent(id)}/ata`
  }
  return model === 'homeDevices' ?
      `/home/devices/${encodeURIComponent(id)}/ata`
    : `/classic/zones/${model}/${id}/ata`
}

// ── AtaValueManager class ──

export class AtaValueManager {
  readonly #applyButton: HTMLButtonElement

  #ataCapabilities: [keyof Classic.GroupState, DriverCapabilitiesOptions][] = []

  readonly #ataValues: HTMLDivElement

  // Bumped whenever a save claims the busy state; only the claim holding
  // the current value may release it (see `#withBusy`).
  #busyGeneration = 0

  #defaultAtaValues: Partial<Record<keyof Classic.GroupState, null>> = {}

  readonly #homey: Homey

  // A save (PUT) is in flight: greys Update and Refresh until it settles.
  #isBusy = false

  readonly #refreshButton: HTMLButtonElement

  // Serialized snapshot of the form as of the last save/(re)load: Update
  // is dirty-gated against it, so it greys out until an edit diverges.
  #savedState = ''

  readonly #zone: HTMLSelectElement

  readonly #zoneMapping: Partial<Record<string, Partial<Classic.GroupState>>> =
    {}

  public constructor(
    homey: Homey,
    ataValuesElement: HTMLDivElement,
    zoneElement: HTMLSelectElement,
  ) {
    this.#homey = homey
    this.#ataValues = ataValuesElement
    this.#zone = zoneElement
    this.#applyButton = getButton('apply_values_melcloud')
    this.#refreshButton = getButton('refresh_values_melcloud')
    // Establish the pristine baseline up front: Update starts greyed even
    // when no zone resolves and the first fetch never runs.
    this.#resetSavedState()
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
    for (const [id, { title, type, values }] of this.#ataCapabilities) {
      const formControl = this.#createAtaControl({ id, type, values })
      // Every control feeds the dirty check so Update tracks edits live:
      // `input` catches typing in the numeric field, `change` the selects.
      formControl?.addEventListener('change', () => {
        this.#updateDirty()
      })
      formControl?.addEventListener('input', () => {
        this.#updateDirty()
      })
      appendFormControl(this.#ataValues, { formControl, title })
    }
  }

  public displayValues(): void {
    this.#syncAtaValues()
    this.#resetSavedState()
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
    // re-fetch mid-edit re-snapshots here); `#withBusy`'s generation guard
    // keeps this from releasing a save that a live PUT still owns.
    this.#resetSavedState()
    return values
  }

  public populateZoneOptions(zones: TargetZone[] = []): void {
    if (zones.length > 0) {
      for (const zone of zones) {
        const { id, level, model, name } = zone
        createOption(this.#zone, {
          id: getZoneId(id, model),
          label: getZoneName(name, level),
        })
        this.populateZoneOptions(getSubzones(zone))
      }
    }
  }

  public async setValues(): Promise<void> {
    await this.#withBusy(async () => {
      const body = this.#buildAtaValuesBody()
      if (Object.keys(body).length > 0) {
        await homeyApiPut(
          this.#homey,
          getAtaStatePath(this.#zone.value),
          body satisfies Classic.GroupState,
        )
      }
      // New pristine baseline is the just-applied form. A rejected PUT
      // throws before this, so the edit stays dirty for a retry.
      this.#resetSavedState()
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
      return createSelect(this.#homey, id, values)
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

  // Snapshots the current form as the new pristine baseline and refreshes
  // the dirty gate: called on (re)load, after each fetch/display, and
  // after a successful save.
  #resetSavedState(): void {
    this.#savedState = this.#serializeState()
    this.#updateDirty()
  }

  // Serializes every control's id and value, in DOM order, into the string
  // the dirty check diffs against. A control still on its mixed/empty state
  // serializes as '', so picking a concrete value registers as a change.
  #serializeState(): string {
    return JSON.stringify(
      [
        ...this.#ataValues.querySelectorAll<HTMLValueElement>('input, select'),
      ].map(({ id, value }) => [id, value]),
    )
  }

  // Refresh is gated by busy ALONE (never dirty), so it stays the escape
  // hatch on a pristine form; Update folds busy into its dirty gate too.
  #setBusy(isBusy: boolean): void {
    this.#isBusy = isBusy
    this.#refreshButton.disabled = isBusy
    this.#updateDirty()
  }

  #syncAtaValues(): void {
    for (const [ataKey] of this.#ataCapabilities) {
      this.#updateAtaValue(ataKey)
    }
  }

  #updateAtaValue(id: keyof Classic.GroupState): void {
    const ataValue = document.querySelector(`#${id}`)
    if (
      ataValue !== null &&
      (ataValue instanceof HTMLInputElement ||
        ataValue instanceof HTMLSelectElement)
    ) {
      ataValue.value =
        this.#zoneMapping[this.#zone.value]?.[id]?.toString() ?? ''
    }
  }

  // Native `disabled` (not a CSS class): it also blocks keyboard
  // activation mid-request and is announced by screen readers. Update is
  // live only when the form diverges from the snapshot AND nothing is in
  // flight — the busy flag folds in so a control change mid-PUT cannot
  // re-enable it.
  #updateDirty(): void {
    this.#applyButton.disabled =
      this.#isBusy || this.#serializeState() === this.#savedState
  }

  #updateZoneMapping(data: Partial<Classic.GroupState>): void {
    const { value } = this.#zone
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }

  // Generation-tokened: a background re-fetch (deviceupdate/zone change)
  // re-snapshots the baseline mid-save, but only the save that owns the
  // current generation may clear the busy state — so a debounced refresh
  // can never release the controls a live PUT still holds.
  async #withBusy(action: () => Promise<void>): Promise<void> {
    const generation = ++this.#busyGeneration
    this.#setBusy(true)
    try {
      await action()
    } finally {
      if (generation === this.#busyGeneration) {
        this.#setBusy(false)
      }
    }
  }
}
