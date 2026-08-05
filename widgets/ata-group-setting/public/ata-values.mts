import type * as Classic from '@olivierzal/melcloud-api/classic'
import {
  ClassicTemperature,
  classicCoolModes,
} from '@olivierzal/melcloud-api/constants'

import type { Settings } from '../../../types/device-settings.mts'
import type { DriverCapabilitiesOptions } from '../../../types/driver-settings.mts'
import type { AtaGroupSettingWidgetSettings } from '../../../types/widgets.mts'
import type { HomeBuildingZone, HomeDeviceZone } from '../../../types/zone.mts'
import { type DirtyGate, createDirtyGate } from '../../../public/dirty-gate.mts'
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
  fireAndForget,
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
  id === 'SetTemperature' &&
  coolModeNumbers.has(Number(getSelect('OperationMode').value))
    ? String(ClassicTemperature.cooling_min)
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
  return model === 'homeDevices'
    ? `/home/devices/${encodeURIComponent(id)}/ata`
    : `/classic/zones/${model}/${id}/ata`
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

  #lastArmingDump = ''

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
    // The gate snapshots its pristine baseline at creation: Update starts
    // greyed even when no zone resolves and the first fetch never runs.
    // Arming goes through `isActionable`, not the snapshot diff: an
    // emptied field means "no instruction" and a value equal to the
    // zone's known state is filtered out, so Update arms only when the
    // request would actually carry something.
    this.#dirtyGate = createDirtyGate({
      applyElement: getButton('apply_values_melcloud'),
      fieldsetElements: [ataValuesElement],
      refreshElements: [getButton('refresh_values_melcloud')],
      isActionable: (): boolean => {
        const body = this.#buildAtaValuesBody()
        const isArmed = Object.keys(body).length > 0
        if (isArmed) {
          this.#reportArming(body)
        }
        return isArmed
      },
      serialize: (): string => this.#serializeState(),
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
    await this.#dirtyGate.runBusy(async () => {
      const body = this.#buildAtaValuesBody()
      if (Object.keys(body).length > 0) {
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
      }
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

  // TEMPORARY debug probe (remove once the on-device arming mystery is
  // solved): reports the exact state that armed Update through the
  // boot-error log channel — the only widget-visible log path.
  #reportArming(body: Classic.GroupState): void {
    const dump = JSON.stringify({
      body,
      fields: [
        ...this.#ataValues.querySelectorAll<HTMLValueElement>('input, select'),
      ].map(({ id, value }) => [id, value]),
      mapping: this.#zoneMapping[this.#zone.value] ?? null,
      zone: this.#zone.value,
    })
    if (dump !== this.#lastArmingDump) {
      this.#lastArmingDump = dump
      fireAndForget(
        this.#homey.api('POST', '/boot-error', {
          message: dump,
          name: 'ArmingProbe',
        }),
      )
    }
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

  #updateZoneMapping(data: Partial<Classic.GroupState>): void {
    const { value } = this.#zone
    this.#zoneMapping[value] = { ...this.#zoneMapping[value], ...data }
  }
}
