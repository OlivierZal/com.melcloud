// The webviews' shared dirty-gating primitive: one gate owns one Apply
// button — greyed while the form matches its saved baseline OR a request
// is in flight — and its sibling Refresh buttons, greyed by busy alone so
// they stay the escape hatch on a pristine form. The factory owns the
// whole invariant; a call site only supplies `serialize`. Byte-identical
// copies of this module live in the sibling Homey apps — edit them
// together.

export interface DirtyGate {
  readonly markSaved: () => void
  readonly recompute: () => void
  readonly runBusy: (action: () => Promise<void>) => Promise<void>
  readonly setBusy: (isBusy: boolean) => void
  readonly wire: (targets: readonly EventTarget[]) => void
}

export interface DirtyGateOptions {
  readonly applyElement: HTMLButtonElement
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

// `serialize` must be a PURE snapshot of the form's current values — never
// a request-body builder: those filter defaults and null deltas out, which
// desyncs the pristine check. The gate snapshots it at creation, so Apply
// starts greyed even when no data ever loads; call `markSaved` after every
// (re)populate and successful save, `wire` on the controls the snapshot
// reads, and route every request through `runBusy`.
export const createDirtyGate = ({
  applyElement,
  refreshElements = [],
  serialize,
}: DirtyGateOptions): DirtyGate => {
  let busyGeneration = 0
  let isBusy = false
  let saved = serialize()
  // Native `disabled` (not a CSS class): it blocks keyboard activation
  // during in-flight actions and is announced by screen readers.
  const recompute = (): void => {
    applyElement.disabled = isBusy || serialize() === saved
  }
  const markSaved = (): void => {
    saved = serialize()
    recompute()
  }
  // Refresh is gated by busy ALONE (never dirty); Apply folds the busy
  // flag into its dirty check so a mid-request edit cannot re-enable it.
  const setBusy = (isBusyNow: boolean): void => {
    isBusy = isBusyNow
    for (const element of refreshElements) {
      element.disabled = isBusyNow
    }
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
