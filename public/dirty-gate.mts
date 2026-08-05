// The webviews' shared dirty-gating primitive: one gate owns one Apply
// button — greyed while the form matches its saved baseline OR a request
// is in flight — its sibling Refresh buttons, greyed by busy alone so
// they stay the escape hatch on a pristine form, and the form's
// fieldsets, frozen by busy alone: every success path rewrites the
// fields, so an edit slipped in mid-flight would be silently clobbered
// when the response lands — the freeze closes that window. The factory
// owns the whole invariant; a call site only supplies `serialize`.
// Byte-identical copies of this module live in the sibling Homey apps —
// edit them together.

export interface DirtyGate {
  readonly markSaved: () => void
  readonly recompute: () => void
  readonly runBusy: (action: () => Promise<void>) => Promise<void>
  readonly setBusy: (isBusy: boolean) => void
  readonly wire: (targets: readonly EventTarget[]) => void
}

export interface DirtyGateOptions {
  readonly applyElement: HTMLButtonElement
  readonly fieldsetElements?: readonly HTMLFieldSetElement[]
  readonly isActionable?: () => boolean
  readonly refreshElements?: readonly HTMLButtonElement[]
  readonly serialize: () => string
}

// `input` covers live typing in number/date fields; `change` covers the
// selects and the final commit (and, since `serialize` reads the whole
// form, any field a cascade handler mutated).
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

// `serialize` must be a PURE snapshot of the form's current values — never
// a request-body builder: those filter defaults and null deltas out, which
// desyncs the pristine check. The gate snapshots it at creation, so Apply
// starts greyed even when no data ever loads; call `markSaved` after every
// (re)populate and successful save, `wire` on the controls the snapshot
// reads, and route every request through `runBusy`. When the wire
// protocol cannot express every form divergence (an emptied field means
// "no instruction" and is omitted from the request), supply
// `isActionable`: Apply then arms only when pressing it would send
// something — the arming predicate gains domain judgment while the
// baseline bookkeeping stays the pure snapshot.
export const createDirtyGate = ({
  applyElement,
  fieldsetElements = [],
  isActionable,
  refreshElements = [],
  serialize,
}: DirtyGateOptions): DirtyGate => {
  let busyGeneration = 0
  let isBusy = false
  let saved = serialize()
  // Native `disabled` (not a CSS class): it blocks keyboard activation
  // during in-flight actions and is announced by screen readers.
  const recompute = (): void => {
    applyElement.disabled =
      isBusy || !(isActionable?.() ?? serialize() !== saved)
  }
  const markSaved = (): void => {
    saved = serialize()
    recompute()
  }
  // Refresh is gated by busy ALONE (never dirty); Apply folds the busy
  // flag into its dirty check so a mid-request edit cannot re-enable it;
  // the fieldsets freeze and thaw with it (`setFrozen`).
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
  const wire = (targets: readonly EventTarget[]): void => {
    wireRecompute(targets, recompute)
  }
  recompute()
  return { markSaved, recompute, runBusy, setBusy, wire }
}
