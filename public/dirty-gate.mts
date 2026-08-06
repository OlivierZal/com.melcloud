// The webviews' shared dirty-gating primitive: one gate owns one Apply
// button — greyed while the form is not worth submitting OR a request
// is in flight — its sibling Refresh buttons, greyed by busy alone so
// they stay the escape hatch on a pristine form, and the form's
// fieldsets, frozen by busy alone: every success path rewrites the
// fields, so an edit slipped in mid-flight would be silently clobbered
// when the response lands — the freeze closes that window. The factory
// owns the whole invariant; a call site only supplies its arming source
// (a pure snapshot or a domain predicate, exclusively).
// Byte-identical copies of this module live in the sibling Homey apps —
// edit them together.

export interface DirtyGate {
  readonly markSaved: () => void
  readonly recompute: () => void
  readonly runBusy: (action: () => Promise<void>) => Promise<void>
  readonly setBusy: (isBusy: boolean) => void
  readonly wire: (targets: readonly EventTarget[]) => void
}

// Arming comes from exactly ONE source. Baseline mode: `serialize` is a
// PURE snapshot of the form's current values — never a request-body
// builder: those filter defaults and null deltas out, which desyncs the
// pristine check — and Apply arms when the snapshot diverges from the
// saved baseline. Predicate mode: when the wire protocol cannot express
// every form divergence (an emptied field means "no instruction" and is
// omitted from the request), supply `isActionable` instead — Apply arms
// only when pressing it would send something, and no baseline exists to
// retain stale form state. The pair is exclusive by type: a predicate
// site has no use for a baseline (the predicate would short-circuit it
// into dead weight).
export type DirtyGateOptions = {
  readonly applyElement: HTMLButtonElement
  readonly fieldsetElements?: readonly HTMLFieldSetElement[]
  readonly refreshElements?: readonly HTMLButtonElement[]
} & (
  | { readonly isActionable?: undefined; readonly serialize: () => string }
  | { readonly serialize?: undefined; readonly isActionable: () => boolean }
)

// Predicate mode consults the domain judgment; baseline mode diffs the
// pure snapshot against the saved baseline.
const isArmed = (
  options: DirtyGateOptions,
  saved: string | undefined,
): boolean =>
  options.isActionable === undefined
    ? options.serialize() !== saved
    : options.isActionable()

// `input` covers live typing in number/date fields; `change` covers the
// selects and the final commit (and, since the arming source reads the
// whole form, any field a cascade handler mutated).
const wireRecompute = (
  targets: readonly EventTarget[],
  recompute: () => void,
): void => {
  for (const target of targets) {
    for (const eventName of ['change', 'input']) {
      target.addEventListener(eventName, recompute)
    }
  }
}

// Fieldsets freeze on busy — `disabled` on the CONTAINER, so a control's
// own `disabled` (a domain state, e.g. an unsupported capability)
// survives the release untouched — and `aria-busy` mirrors the freeze
// for assistive tech.
const setFrozen = (
  fieldsetElements: readonly HTMLFieldSetElement[],
  isFrozen: boolean,
): void => {
  for (const element of fieldsetElements) {
    element.disabled = isFrozen
    element.setAttribute('aria-busy', String(isFrozen))
  }
}

// The gate evaluates its arming at creation, so Apply starts greyed even
// when no data ever loads; call `markSaved` after every (re)populate and
// successful save (in predicate mode it only re-evaluates — there is no
// baseline to move), `recompute` after any programmatic field write (no
// `input` event fires for those), `wire` on the controls the arming
// source reads, and route every request through `runBusy`. Buttons grey
// through native `disabled` (not a CSS class): it blocks keyboard
// activation during in-flight actions and is announced by screen
// readers.
export const createDirtyGate = (options: DirtyGateOptions): DirtyGate => {
  const { applyElement, fieldsetElements = [], refreshElements = [] } = options
  let busyGeneration = 0
  let isBusy = false
  let saved = options.serialize?.()
  const recompute = (): void => {
    applyElement.disabled = isBusy || !isArmed(options, saved)
  }
  const markSaved = (): void => {
    saved = options.serialize?.()
    recompute()
  }
  // Refresh is gated by busy ALONE (never dirty); Apply folds the busy
  // flag into its arming check so a mid-request edit cannot re-enable
  // it; the fieldsets freeze and thaw with it (`setFrozen`).
  const setBusy = (isBusyNow: boolean): void => {
    isBusy = isBusyNow
    for (const element of refreshElements) {
      element.disabled = isBusyNow
    }
    setFrozen(fieldsetElements, isBusyNow)
    recompute()
  }
  // Generation-tokened: only the action holding the latest claim may
  // release the busy state, so an overlapping action can never free the
  // buttons a live request still owns.
  const runBusy = async (action: () => Promise<void>): Promise<void> => {
    const generation = ++busyGeneration
    setBusy(true)
    try {
      await action()
    } finally {
      if (generation === busyGeneration) {
        setBusy(false)
      }
    }
  }
  recompute()
  return {
    markSaved,
    recompute,
    runBusy,
    setBusy,
    wire: (targets: readonly EventTarget[]): void => {
      wireRecompute(targets, recompute)
    },
  }
}
