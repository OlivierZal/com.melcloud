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
  `settings/index.{js,mjs}` and `widgets/*/public/index.{js,mjs}` are
  gitignored build outputs, never checked in. The Homey CLI DOES run
  `npm run build` when it detects TypeScript (`devDependencies.
typescript`; it validates `outDir: .homeybuild`) — but only AFTER
  its pre-process copy into `.homeybuild`. The tsc emit lands in
  `.homeybuild` (contract respected, the app code ships); esbuild's
  outputs land in the SOURCE tree, too late to be copied, so a package
  built from a pristine checkout ships the webview HTML without its
  scripts — the #1404 root cause: every store install 404s the
  bundles. Local installs work because the pre-push suite builds the
  bundles into the source tree BEFORE the copy. publish.yml therefore
  runs `build:assets` before the publish action (the same pre-copy
  pattern as the local flow) and asserts every bundle exists.
- Cache-busting `?v=` — the build also stamps every local asset reference
  in the tracked `*/index.html` with a content hash (`?v=<hash>`), so
  phone webviews (which cache assets across app versions) refetch an
  asset exactly when its bytes change. **Never hand-edit a `?v=` or bump
  it "for a release": it is a content hash, not a version** — the build
  sets it, and it moves automatically iff the asset content changes
  (identical bytes → identical hash → no diff; a release that touches no
  webview asset leaves every `?v=` untouched, which is correct). Because
  the HTML is committed, any change to a bundled webview source
  (`settings/**`, `widgets/*/public/**`, their CSS) must be followed by
  `npm run build` and a commit of the re-stamped HTML. The mandatory
  pre-push suite runs the build, so following it keeps the stamp in sync;
  skipping it ships a stale `?v=` and phones keep serving the old cached
  bundle — the exact staleness `?v=` exists to prevent.
- `npm run homey:validate` — Homey validation at publish level; may
  rewrite files (see locales below), re-stage if it does.
- `node scripts/sync-capability-definitions.mjs` — refreshes the
  vendored node-homey-lib capability JSONs under `vendor/capabilities/`
  (homey-lib is a devDependency and must not ship to the device); the
  drift test in `tests/unit/capability-definitions.test.ts` fails when
  the copies fall behind.
- `npm run homey:start` — `homey app run --remote` for on-device testing.
  The `homey:install`/`homey:start`/`homey:publish` wrappers run
  `build:assets` first: the CLI's pre-process copies the app BEFORE its
  own `npm run build` runs, so bundles must already sit in the source
  tree to be packed (same pre-copy pattern as publish.yml). `build`
  keeps `build:assets` inside it on purpose — it is both the CLI hook
  (contract: tsc into `.homeybuild`; extras tolerated) and the dev entry
  point whose run keeps the committed `?v=` stamps in sync.

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
  Home ATW (not in the app UI; an absent setting would read as 0).
  Forced hot water IS app-exposed (the DHW tab's auto/heat-now toggle,
  write path live-verified), and so are the per-zone states: the app
  displays them as a projection of the top-level `OperationMode`
  (live-observed: a legionella cycle shows the zone idle), which is
  exactly what `operationalStateZone1/2` derive API-side — the Classic
  flag refinements do not exist on the Home wire.
- Home drivers compute capabilities per device from the facade — at
  pairing (`toDeviceDetails`) and again at device init
  (`getRequiredCapabilities`). `isOwner` gates NOTHING, on any driver:
  the MELCloud Home app hides the ATW power toggle and precise zone
  modes from guests, but the BFF enforces no owner/guest distinction —
  guest `curve` write and a full guest power round-trip were both
  `/context`-readback-verified (2026-07-14, melcloud-api
  `scripts/probe-guest-precise-modes.ts` / `probe-guest-power.ts`),
  as were the guest ATA writes earlier. App-UI narrowing is NOT a
  permission: only server-verified behavior gates capabilities.
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

- Webview lifecycle (settings page included): the bundle is a CLASSIC
  IIFE (esbuild `format: 'iife'`, `globalName: MELCloudWebview`), loaded
  via `<script defer src="index.js">` — NOT an ES module. What is proven
  on-device: a STATIC `<script type="module">` stalls the whole boot on
  a cold open (and since the SDK fires `onHomeyReady` only after `load`,
  the stalled module fetch blocks even that, so nothing runs at all),
  while classic scripts — like the stylesheets — load cold. Dynamic
  `import()` (the docs' canonical form) also works when the bundle
  exists: its supposed Android fetch failures were #1404's real cause,
  store packages shipping no bundles at all. The classic form stays
  because it is strictly more robust — bounded boot plus in-band beacon
  — not because `import()` is broken. Each HTML declares the docs'
  canonical global
  `function onHomeyReady(homey)` inline (it must exist at parse time),
  which polls `globalThis.MELCloudWebview` and calls its `start(homey)`
  once the bundle is up. `defer` (not `async`) is the right fit for an
  app bundle that reads the DOM: it runs ordered, after `<body>` parses
  and before DOMContentLoaded, so there is never a top-level-DOM race and
  the poll finds the global on its first tick. (This leans on classic
  fetches loading cold — the whole point of the fix; a stalled `defer`
  would block the SDK too, but classic fetches do not stall.) Two
  guarantees keep the overlay finite,
  for two distinct phases (no overlap): the `onHomeyReady` poll's 10 s
  timeout ends it if the bundle never loads (`#init_error` / post-ready
  alert), and `runWebview`/`withInitTimeout` end it if a DATA fetch hangs
  during init (`Homey.ready()` in a `finally`). `scripts/bundle.mjs`
  stamps every local asset reference — only inside an attribute/import
  context, never a comment — with a content hash (`?v=`): phone webviews
  cache assets across app versions. Webview code must stick to es2020-era
  runtime APIs (no `Object.groupBy` & co.): esbuild lowers syntax only,
  and old iOS engines are real. Never load the bundle as a STATIC
  `<script type="module">`: 45.2.5 shipped that and every webview spun
  forever on a cold open (proven with breadcrumbs over `homey app run`;
  reverted). Dynamic `import()` is merely unnecessary, not broken — its
  supposed Android fetch failures were the missing-bundle 404s — but do
  not churn the loading mechanism again without new on-device evidence:
  classic `defer` is the cold-verified form and carries the bounded
  boot plus beacon. Phone webviews also cache the HTML ITSELF across app
  versions
  (proven in the wild: a cached dynamic-import-era HTML requested
  `index.mjs?v=…` against a 45.2.6 app shipping only `index.js` → 404 →
  "Loading failed"), so shipped bundle filenames are a COMPAT CONTRACT:
  `scripts/bundle.mjs` builds every entry twice — `index.js` (IIFE) for
  the current HTML, `index.mjs` (ESM) for every cached ESM-era HTML,
  which is why the entries keep `export const start`. Never rename or
  drop a shipped bundle filename; add alongside. When a bundle still
  fails to boot, the `onHomeyReady` poll's timeout beacon POSTs the
  `userAgent` plus a `fetch` probe of the bundle to `/boot-error`
  (`app.error`) before degrading, so a diagnostic report distinguishes
  a fetch failure (probe error / non-200) from a parse-or-runtime crash
  (probe 200, global absent — think pre-es2020 engines).
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
- A config-level `'off'` with a one-line reason is not a disable: it
  is the triage ledger for opt-in rules that were evaluated and
  refused (tool-ownership overlap, platform floor, absent domain).
  Disables suppress an adopted rule; ledger entries record a verdict —
  re-evaluate one when its stated reason expires (target bump, new
  tooling).
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
- Homey App Store releases: write the user-facing changelog entry into
  `.homeychangelog.json` under the NEW version key (all 13 locales,
  non-exhaustive store-facing wording), bump `version` in
  `.homeycompose/app.json`, align `package.json` via
  `npm version X.Y.Z --no-git-tag-version`, run `homey:validate` to
  regenerate `app.json`, and land it all through a PR. Then tag
  `vX.Y.Z` and publish a GitHub release: `publish.yml` fires on
  release-published (environment `homey`) and pushes to the App Store
  via athombv's action. Do NOT dispatch `update-version.yml` — it
  commits directly to `main` and fails against the ruleset (known
  debt); the PR + release flow above replaces it.
- Store submissions: a rejected version number cannot be resubmitted —
  bump the patch version.
