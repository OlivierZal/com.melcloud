# CLAUDE.md

Homey app for MELCloud (Mitsubishi Electric AC/heat-pump cloud). ESM only,
Node >= 22.19. The API layer lives in `@olivierzal/melcloud-api` (GitHub
Packages, sibling repo with its own CLAUDE.md) — API bugs are fixed there,
not worked around here.

## Commands

Run the FULL suite before any push — CI runs all of it and each step has
caught real failures that the others miss:

- `npm run format` / `npm run format:fix` — prettier (eslint does NOT
  cover formatting).
- `npm run lint` / `npm run lint:fix` — ESLint (needs its 8 GB heap; also
  lints CSS and HTML via the css/html plugins).
- `npm run typecheck` — `tsc` from `@typescript/native` (TypeScript 7).
- `npm test` / `npm run test:coverage` — vitest; branches are at 100%,
  keep them there.
- `npm run build` — esbuild bundles (`scripts/bundle.mjs`) + `tsc` emit.
  `settings/index.mjs` and `widgets/*/public/index.mjs` are gitignored
  build outputs, never checked in; the Homey CLI regenerates them on
  validate/install/run.
- `npm run homey:validate` — Homey validation at publish level; may
  rewrite files (see locales below), re-stage if it does.
- `node scripts/sync-capability-definitions.mjs` — refreshes the
  vendored node-homey-lib capability JSONs under `vendor/capabilities/`
  (homey-lib is a devDependency and must not ship to the device); the
  drift test in `tests/unit/capability-definitions.test.ts` fails when
  the copies fall behind.
- `npm run homey:start` — `homey app run --remote` for on-device testing.

Check real exit codes; never pipe a check's output through `tail`/`grep`
to judge success. Remove any `.claude/worktrees/**` leftovers before
running the suite — the vitest/eslint globs sweep them and corrupt
coverage.

## Homey platform gotchas

- `.homeycompose/` is the SOURCE for `app.json` and `locales/*.json`; the
  Homey CLI regenerates those outputs on every preprocess and writes them
  WITHOUT a trailing newline. Commit the CLI-generated form verbatim — do
  not "fix" the missing newline, and never edit generated files directly.
- `homey:validate` acts as a pre-push formatter hook of sorts: if it
  touches files, amend before pushing.
- Widget webviews get Homey's injected class-based stylesheet and the
  `--homey-*` design tokens at runtime; that stylesheet is not in the repo
  and not available offline.
- The settings page (`settings/`) uses Homey's official `homey-form-*` /
  `homey-button-*` classes; `settings/index.css` only fills documented SDK
  gaps (date inputs, checkbox `:indeterminate`, `fieldset[hidden]`
  specificity) and app-specific design.

## Driver conventions

- Each API side has an intermediate driver/device base under `drivers/`
  (`classic-driver`/`classic-device`, `home-driver`/`home-device`):
  shared behavior lives there (or in the `base-*` classes when both
  sides share it); type-specific classes hold only converters,
  capability policies, and manifests.
- `capabilitiesOptions` blocks that are rigorously identical across the
  drivers defining them live in the `defaults` compose template;
  `melcloud_atw`'s labels are the reference (node-homey-lib wording).
  Template entries for capabilities a driver lacks are inert, but a
  capability another driver configures differently stays per-driver
  (e.g. `target_temperature`: ATA 10–31, ATW 10–30) — precedence would
  resolve the collision, relying on it is a trap.
- `measure_signal_strength` is never a default capability, on any driver:
  it stays manifest-declared but opt-in through the shared `options`
  settings group. Keep it out of every required-capability list.
- Home drivers only ship surfaces the MELCloud Home app itself exposes,
  even when the API facade can read more — no outdoor temperature on
  Home ATW (not in the app UI; an absent setting would read as 0), and
  no per-zone operational states (their derivation inputs are absent
  from the Home wire). Forced hot water IS app-exposed (the DHW tab's
  auto/heat-now toggle) and its write path is live-verified.
- Home drivers compute capabilities per device from the facade — at
  pairing (`toDeviceDetails`) and again at device init
  (`getRequiredCapabilities`). Home ATW gates the control capabilities on
  `isOwner` (guests get the measures only): the MELCloud Home app hides
  the ATW control surface from guests and guest ATW writes are unverified
  against the BFF. Home ATA is deliberately NOT gated — live probing
  showed the BFF accepts guest ATA writes. Do not harmonize the two.
- New FTC vocabulary must never crash a sync — and that tolerance lives
  in melcloud-api, not here: the Home ATW facade getters normalize the
  wire dialect (`HomeAtwZoneMode`, `operationalState`), degrading
  unknown zone modes to the room modes, so the app-side converters are
  plain field picks.
- Flow-card device filters are `driver_id=<manifest owners>&capabilities=<cap>`,
  both parts mechanical: `capabilities=` is the card's real precondition
  (the run listeners are capability-generic and triggers fire through
  Homey's `<capability>_changed` convention — the picker follows what
  each device actually ships), and `driver_id` lists every driver whose
  MANIFEST declares the capability — required by the platform, not by
  us: homey-lib's validator only exempts a device arg from the
  `[[device]]` titleFormatted token when its filter carries `driver_id`
  (`homey-lib/lib/App/index.js`, `firstDeviceArgument`). No population
  judgment goes into filters; the verification gate lives in
  `getRequiredCapabilities` alone.
- Runtime capability options (`getCapabilitiesOptions` → pairing details
  and `setCapabilityOptions` at init) must be complete option objects,
  and only for capabilities the device actually gets: device-level
  options shadow the manifest's per capability (a bare `{max, min}`
  would drop the manifest step/title), and setting options on an absent
  capability fails. Temperature ranges/steps/titles live in the compose
  manifest; the only runtime options are enum values (thermostat modes,
  fan speeds).

## Widgets

- Widgets ship separately; they cannot share files at runtime. The zone
  selector's ghost styling is deliberately duplicated as byte-identical
  `styles/zone-select.css` twins, pinned by `tests/unit/widget-styles.test.ts`
  — edit both or the suite fails.
- `ata-group-setting` animations are WAAPI on compositor-only properties
  (`transform`/`translate`/`rotate`/`scale`, `opacity`): no per-element
  `filter` on particles (a blur per smoke puff collapsed real devices),
  no rAF loops, budgets on particle counts. Individual transform
  properties compose without clashing on `transform`.
- Animation orchestration is AbortController-based: the scene controller
  owns spawn loops, each flame owns its smoke chain via its own
  controller, `applyAnimation` is guarded by a generation token re-checked
  after every await, and the mode→scene mapping lives in one pure resolver
  (`MODE_SCENES`). Fetches happen BEFORE teardown so failures leave the
  running scene untouched. Desktop POCs lie about widget-scale
  performance: dozens of flames × per-flame chains is the real load —
  measure with a widget-scale harness before trusting an animation change.
- `charts` uses Chart.js v4 tree-shaken registration. `border.dash` styles
  the grid lines (the axis border is always solid) — that is v4 semantics,
  not a bug. Legend-toggle state is index-keyed or identity-keyed inside
  Chart.js and does not survive config replacement: visibility is carried
  across refreshes by label (`#captureHiddenByLabel`).
- Scale ids are `xAxis`/`yAxis` because the id-length lint bans `x`/`y`
  keys.

## Lint doctrine

- Code adapts to the rules, never the reverse. Never add a disable — not
  inline, not through config options or ignore regexes: refactor until
  the rule passes (rename the binding, move the polymorphic default to a
  nullable field, push the logic to a class that uses `this`, route casts
  through the shared typed helpers…). The existing disables are debt:
  remove them when touching the code they guard, never replicate them.
  One counterweight: when every compliant shape reads worse than the
  violation (a rule's own documented exception like a sequential-by-design
  loop, a protocol-imposed form, a rule-pair conflict), the documented
  disable IS the honest form — simplicity outranks disable-count golf.
- Zero-warning policy: every enabled rule is at `error`.
- Metric caps (`complexity`, `max-statements` 10, `max-depth`,
  `unicorn/try-complexity` 1…) are measured codebase ceilings: exceeding
  one means extract/refactor, not bump.
- Class members sort alphabetically (perfectionist), fields before
  methods, public before private. Increments use prefix `++`/`--`.
- Comments state intent or a constraint the code cannot show — never
  history ("was X before"), narration, or the library something came from.
- Beware `no-unnecessary-condition` vs TypeScript's control-flow
  narrowing across `await`: a re-check of externally-mutated state (e.g.
  `signal.aborted`) reads as "always false" — route through an API that
  reads the live value instead (`signal.throwIfAborted()`).

## Repo process

- `main` is protected (PRs only, squash merges, 6 required contexts,
  `strict=false`); merge queue is impossible (user-owned repo, org-only
  feature). Copilot reviews every PR — answer every comment, and verify
  its claims against sources before acting: it has been wrong about
  library semantics.
- Verify claimed library behavior empirically (headless chromium against
  the real dist/bundle in the scratchpad) rather than from memory — this
  repo's PRs document several review claims refuted that way.
- `update-version.yml` pushes directly to `main` and will fail against
  the ruleset (known debt).
- Store submissions: a rejected version number cannot be resubmitted —
  bump the patch version.
