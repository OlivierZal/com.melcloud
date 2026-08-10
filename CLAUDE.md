# CLAUDE.md

Homey app for MELCloud (Mitsubishi Electric AC/heat-pump cloud). ESM only,
Node >= 22.19. The API layer lives in `@olivierzal/melcloud-api` (GitHub
Packages, sibling repo with its own CLAUDE.md) — API bugs are fixed there,
not worked around here.

## Commands

Run the FULL suite before any push — CI runs all of it and each step has
caught real failures that the others miss:

- `npm run format` / `npm run format:fix` — prettier (eslint does NOT
  cover formatting). It owns `.html` layout too: indentation, attribute
  wrapping and the ` />` on void elements are its call, and the
  `html/` rules that contradicted that output are off in the preset.
  Only `coverage/` and `.homeybuild/` escape it, through `.gitignore` —
  the pages under them are generated.
- `npm run lint` / `npm run lint:fix` — ESLint (needs its 8 GB heap; also
  lints CSS and HTML via the css/html plugins). What the html plugin
  keeps is what prettier does NOT do: `head-order`, `sort-attrs` (`id`
  before `class`, then alphabetical — the pages already comply, so its
  silence means conformance, not absence) and
  `no-whitespace-only-children`, plus the quality rules.
- `npm run typecheck` — `tsc` from `@typescript/native` (TypeScript 7).
- `npm test` / `npm run test:coverage` — vitest; branches are at 100%,
  keep them there.
- `npm run build` — esbuild bundles (`scripts/bundle.mts`) + `tsc`
  emit, BOTH into `.homeybuild`. The Homey CLI runs `npm run build`
  when it detects TypeScript (`devDependencies.typescript`; it
  validates `outDir: .homeybuild`) — but only AFTER its pre-process
  copy into `.homeybuild`, so the source tree stays sources-only and
  everything the package needs must be emitted there: tsc does it via
  `outDir`, and `bundle.mts` emits the webview bundles there too (its
  former source-tree outfiles landed too late to be copied — the #1404
  root cause: every store install 404'd the bundles). The CLI's own
  build invocation is therefore sufficient for install, run, validate
  and publish alike; a standalone suite run (no `.homeybuild` page
  copies) still proves the bundles compile.
- Cache-busting `?v=` — a PACKAGE-TIME transform: `bundle.mts` stamps
  every local asset reference of the `.homeybuild` page copies with a
  content hash (`?v=<hash>`), so phone webviews (which cache assets
  across app versions) refetch an asset exactly when its bytes change.
  The pattern anchors on `href="` / `src="` as one unit, so a reference
  survives prettier splitting a long tag across lines; a leading `/`
  is barred, which is what keeps the SDK's `/homey.js` unstamped.
  The committed source HTML carries NO stamps — never hand-add a `?v=`
  there, and nothing needs re-committing when a webview source changes
  (the old re-stamp-and-commit dance is gone). Stamps exist only in the
  packaged app, and only within attribute/import reference contexts,
  never comments. A second cache layer covers the HTML
  itself (phone webviews cache the page across app versions,
  force-close included): each bundle carries a freshness handshake —
  the page's identity is the document-order join of its UNIQUE `?v=`
  stamps — a CSS-only ship moves it too, and the dedup is by HASH VALUE
  on BOTH sides (the kit's page-side join and `webview-stamp.mts`):
  two assets with identical bytes carry one stamp on the page, so a
  bundler counting them twice would mint an identity no page could ever
  match — an endless refetch handshake (fixed and pinned, 2026-08) —,
  `GET /webview-hashes` serves the
  live hashes (a manifest `bundle.mts` emits into the packaged app,
  read by `@olivierzal/homey-kit/node`; every `api.mts` — app and both
  widgets — passes the manifest URL explicitly, the kit's default
  resolving against its own module inside `node_modules`), and a
  mismatch triggers ONE
  refetch of the document through a never-cached address
  (`?fresh=<identity>` — a bare reload can be re-served the same stale
  document from the HTTP cache; sessionStorage guard,
  `watchWebviewFreshness` from `@olivierzal/homey-kit/webview`, wrapped
  for the widget transport by `public/webview-freshness-boot.mts`), whose
  fresh stamps pull the fresh assets;
  a mismatch that survives its refetch is reported to
  `POST /boot-error`. The guarantee lives in the BOOT check, and which
  surface needs it was measured on device (2026-08-07): the web-app
  settings page is destroyed and REMOUNTED when the app restarts, and
  mobile widgets reload too — both are fresh for free. Only the mobile
  settings page survives an app restart, so it alone never boots again;
  that is why the watcher re-checks on RETURN TO THE FOREGROUND
  (`visibilitychange`), the trigger that covers it. The app also emits a
  `webview_hashes_changed` realtime event at its own boot and every page
  subscribes to it, but it guarantees NOTHING on its own: it fires at
  the end of the app's `onInit`, i.e. exactly when the restart has just
  disconnected every open page, so its audience is absent by
  construction (measured: an open mobile page produced no request and no
  breadcrumb). Never fold the visibility trigger into it. Every failure
  path stays open: an unstamped page, an absent route or denied
  storage must never take a working webview down.
  The stamping pass itself lives in `scripts/webview-stamp.mts` (and the
  vendored-JSON key sort in `scripts/sort-keys-deep.mts`), unit-tested
  against a temp packaging tree; `bundle.mts` and
  `sync-capability-definitions.mts` keep only their tables and the
  esbuild/fs calls consuming them — the two named, file-scoped coverage
  exclusions left in `vitest.config.ts` and `sonar-project.properties`
  (never a directory sweep, and `npm run build` plus the drift test
  exercise them end to end). esbuild runs in a service process with its
  own cwd, so both the build and the stamping anchor on an explicit
  repo root (`absWorkingDir`), never the launcher's.
- `npm run homey:validate` — Homey validation at publish level; may
  rewrite files (see locales below), re-stage if it does.
- `node scripts/sync-capability-definitions.mts` — refreshes the
  vendored node-homey-lib capability JSONs under `vendor/capabilities/`
  (homey-lib is a devDependency and must not ship to the device); the
  drift test in `tests/unit/capability-definitions.test.ts` fails when
  the copies fall behind.
- `npm run homey:start` — `homey app run --remote` for on-device testing.
  The `homey:*` wrappers are plain CLI calls: the CLI's own
  `npm run build` (post-copy) emits everything the package needs into
  `.homeybuild`, so no pre-build step is required anywhere.

Test harnesses that simulate the clock stub `Temporal.Now`, NEVER
`Date`: `temporal-polyfill` delegates to `globalThis.Temporal` wherever
the runtime ships one (Node 26, i.e. the CI's "Node latest" leg), so a
faked `Date` never reaches the page's clock — the failure mode is a
suite that passes locally and fails only on that leg.

Check real exit codes; never pipe a check's output through `tail`/`grep`
to judge success. Remove any `.claude/worktrees/**` leftovers before
running the suite — the vitest/eslint globs sweep them and corrupt
coverage.

## Homey platform gotchas

- The published app id is `com.mecloud` — the original submission's
  typo, now LOAD-BEARING: the id is the app's platform identity
  (pairing, install base, inter-app API), so publishing under the
  corrected spelling would be a new app and would orphan every paired
  device. Everything derived keeps the typo: the store URL
  (`https://homey.app/a/com.mecloud`) and the id the extension uses to
  address this app. Never "fix" the missing `l` anywhere — manifest,
  code or docs links (a README "fix" once turned the working store
  link into a 404; reverted, 2026-08).
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
  gaps (date inputs, checkbox `:indeterminate`, disabled greying and
  freeze dim, hidden/injected-cascade specificity) and app-specific
  design.
- App-API surface conventions: paths are kebab-case REST (`get*` for
  GET — except `is*` for a boolean GET —, `update*` for PUT — never
  `set*` —, and a business verb for POST: `*Authenticate` on
  `/sessions`, `logWebviewBoot` on `/boot-error`); handler renames are
  wire-invisible (routing is method+path), path renames are NOT (phone
  webviews cache bundles across versions; stale callers now surface an
  error — legacy aliases were dropped by decision, 2026-07). The
  inter-app grouping route is `GET /devices/groups` (the extension
  degrades to "no grouping" when it is absent).
  `@olivierzal/homey-kit/settings` is the settings pages' transport
  (the settings SDK is error-first-callback, unlike the widget SDK —
  which is why `public/homey-api.mts` stays a separate, promise-native
  widget layer). The surface is
  test-pinned in two halves, one file each — extend BOTH when touching
  a route: `tests/unit/api-contract.test.ts` (since #1261) pins
  manifest ids ↔ handlers both ways plus the handlers' function type,
  on all three surfaces;
  `tests/unit/api-route-guards.test.ts` pins the
  call sites — every path a webview writes, literal or template-built,
  must match a declared route of its own surface, under a declared
  method. Both are the kit's table-driven kernels
  (`@olivierzal/homey-kit/testing`): each file holds this app's tables
  and the factory call, nothing else. Its load-bearing clause is the call-site
  accounting: every `homeyApi*` site must be parsed or hand over a path
  it does not spell, which is what makes a broken extractor a failure
  instead of a silent pass, and what makes separate "the regex still
  matches" clauses redundant.
- Dirty-gating: `createDirtyGate` (`@olivierzal/homey-kit/webview`) is
  the ONE primitive behind every
  webview Apply/Refresh pair (settings sections, frost/holiday/overheat
  panels, the credentials section, the ATA group widget) — never
  re-derive its invariant at a call site. The gate also freezes the gated
  fieldsets while a request is in flight (container `disabled` +
  `aria-busy`, so a control's own domain `disabled` survives the thaw):
  every success path rewrites the fields, so a mid-flight edit would be
  silently clobbered — pass every region the arming source reads through
  `fieldsetElements`. Arming comes from exactly ONE source, exclusive by
  type: baseline mode (`serialize`, a pure snapshot diffed against the
  saved baseline) or predicate mode (`isActionable`, for wire protocols
  that cannot express every form divergence — an emptied field means "no
  instruction" and is omitted from the request — with no baseline to
  retain stale form state); the ATA group widget arms through its body
  builder this way, and the credentials section arms only when both
  fields are filled (its Reset button rides the gate as a Refresh —
  greyed by busy alone; in predicate mode `markSaved` only re-evaluates).
  A baseline `serialize` must stay a PURE form snapshot, never a
  request-body builder
  (those filter null deltas out and desync the pristine check — the
  historical heatzy bug), and disabled greying styles
  `[class*='homey-button']:disabled` generically, never a per-class list
  (a class list silently missed renamed buttons).
  The kit's own suite locks the behavior — a change to the gate is a kit
  release, adopted here by an exact-pin bump.
- Settings-CSS sharing — VERDICT (2026-08, after the `./dom` adoption):
  the cascade fixes STAY LOCAL, in all three apps. Two independent
  reasons, either sufficient. (1) The kit ships no stylesheet and
  exports no CSS entry (`.`, `./dom`, `./manifest`, `./node`,
  `./settings`, `./testing`, `./types`, `./webview`, `./widget` — all
  JS): sharing them would mean inventing a CSS delivery path, and since
  webviews load plain `<link>` tags from the packaged app, each app's
  `bundle.mts` would have to copy the file into `.homeybuild` at
  package time. That is a new packaging contract, not a 15-line move.
  (2) Only about a third of the file is generic by construction — the
  rules encoding a kit or SDK contract rather than app design:
  `body fieldset[hidden]`, the `.homey-form-group` checkbox-set restack
  and its sibling margin, `[class*='homey-button']:disabled`, the
  `busy-scope` pair and the `fieldset[disabled]` pair (the dirty-gate
  freeze contract), plus the `:indeterminate` checkmark. The rest is
  this app's own: the zone select, the error-log table, the
  `datetime-local` holiday inputs, the credentials summary and its
  reset button. A shared file would therefore carry a minority of the
  lines while adding a delivery mechanism to three apps. Revisit only
  if the kit gains a stylesheet export for other reasons — never as a
  standalone refactor.
- The injected sheet resets `fieldset.homey-form-checkbox-set` /
  `-radio-set` with `all: unset`, which leaves `display: inline` — and
  WebKit renders inline fieldsets atomically, so SIBLING sets tile side
  by side (the 45.7.5 settings regression; a single set per section had
  hidden it for years). `settings/index.css` restacks them with a
  higher-specificity block rule. That is the general rule for ANY own
  rule that must beat the injected sheet: its rules sit at (0,1,1) and
  a tie falls to injection order, so the own rule needs an ancestor
  selector — `body fieldset[hidden]`, `body fieldset[disabled]`,
  `body fieldset.busy-scope`, the `.homey-form-group` restack — never a
  bare (0,1,1) form. Only an on-device open can catch a lost tie (a
  headless probe has no injected sheet), so any markup change that
  multiplies `homey-form-*` elements needs an on-device cold-open
  check: the injected sheet's resets make untested combinations render
  arbitrarily.

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
  `/context`-readback-verified (2026-07-14, via local
  probe scripts under melcloud-api's gitignored `scripts/` — research
  artifacts, not in any clone),
  as were the guest ATA writes earlier. App-UI narrowing is NOT a
  permission: only server-verified behavior gates capabilities.
- New FTC vocabulary must never crash a sync — and that tolerance lives
  in melcloud-api, not here: the Home ATW facade getters normalize the
  wire dialect (`HomeAtwZoneMode`, `operationalState`), degrading
  unknown zone modes to the room modes, so the app-side converters are
  plain field picks.
- The ATA GROUP vocabulary is already cross-family, and its `Classic`
  prefix is history, not a branch: `ClassicGroupState` is the one shape
  both families' ATA facades implement (`getGroup` / `updateGroupState`),
  the Home device and building facades projecting their own dialect at
  their boundary (`toClassicAtaGroupState` / `toHomeAtaValues`) —
  `OperationMode` included, so a group state is ALWAYS Classic-numbered
  whatever API served it, and `classicCoolModes` / `ClassicTemperature`
  (documented universal across ATA models) apply to both. Consumers
  therefore never branch on the family to READ or WRITE a group state;
  the only family-visible step is ADDRESSING, because a Home building or
  device id and a Classic zone type + id are reachable only through
  distinct routes. The prefix has twice been misread as a missing
  abstraction (2026-08) — it is the common surface.
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
  during init (`Homey.ready()` in a `finally`). `scripts/bundle.mts`
  stamps the PACKAGED `.homeybuild` page copies — only inside an
  attribute/import context, never a comment — with a content hash
  (`?v=`): phone webviews cache assets across app versions; the source
  HTML stays unstamped. Webview runtime-API floor: es2023 array
  methods are accepted (`toSorted`/`toReversed` — the lint mandates
  them and they ship today), but nothing newer — no iterator helpers
  (`.entries().map()`, 2025-era), no `Object.groupBy` & co.: esbuild
  lowers syntax only, and old iOS engines are real. Never load the
  bundle as a STATIC
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
  `scripts/bundle.mts` builds every entry twice — `index.js` (IIFE) for
  the current HTML, `index.mjs` (ESM) for every cached ESM-era HTML,
  which is why the entries keep `export const start`. Never rename or
  drop a shipped bundle filename; add alongside. When a bundle still
  fails to boot, the `onHomeyReady` poll's timeout beacon POSTs the
  `userAgent` plus a `fetch` probe of the bundle to `/boot-error`
  (`app.error`) before degrading, so a diagnostic report distinguishes
  a fetch failure (probe error / non-200) from a parse-or-runtime crash
  (probe 200, global absent — think pre-es2020 engines).
- The ATA group widget's target temperature is a SELECT, never a
  free-text number: a phone keyboard let a decimal separator through and
  the widget sent the truncated integer ("23," → 23). Its options are
  GENERATED from the grid the app serves with each capability, never
  hardcoded: MELCloud accepts HALF degrees, and a whole-degree picker
  would forbid what the truncating input merely mangled. The bounds are
  the DRIVER MANIFEST's narrowing (`target_temperature`: 10–31) over the
  vendored node-homey-lib generic definition (4–35). The STEP is the
  capability's own: node-homey-lib declares no root `step` for
  `target_temperature` (only `decimals: 1`), and states 0.5 on its flow
  action's range argument — `lib/capability-flow-step.mts` reads exactly
  that. Using a flow-arg field as a UI grid IS an inference; it is
  taken deliberately because the value is Athom's own and the vendored
  copy sits under the drift test, so an upstream change surfaces
  instead of rotting. NEVER re-declare a `step` in the driver manifests
  to get one: a partial explicitation (declared on some capabilities,
  absent on others) is an asymmetry no reader can explain — all or
  nothing (decision, 2026-08). Only the cooling floor comes from
  melcloud-api (`ClassicTemperature.coolingMin`): it is mode-dependent,
  which no manifest can express. An untouched or mixed mode keeps the
  widest range, since the device's own mode stays in place, and a device
  reporting an off-grid value keeps it as an option, so nothing it holds
  becomes unselectable or gets silently dropped. Labels are formatted in
  the page language (a comma in French) while the option VALUE stays the
  wire form. The offered envelope is deliberately the UNIVERSAL one: a
  group may mix models, and each device's own per-mode limits narrow the
  write API-side (the Classic ATA facade clamps against its reported
  `MinTempCoolDry`/`MaxTempHeat` and friends). Never duplicate that
  clamp widget-side.
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

## Naming & authored-content conventions

- What `@typescript-eslint/naming-convention` cannot see is convention
  too: booleans read as questions even untyped (`isX`/`hasX`), handlers
  as verbs; a name states what the thing IS, never its history. Test
  files are named after the unit under test (`<module>.test.ts`); shared
  test helpers keep their family's names — apps say `assertDefined` and
  `mock(overrides)` where the libraries say `defined` and
  `mock(value?)`: two test families, deliberately not unified.
- Static markup and styles live in `.html`/`.css` files. TS builds DOM
  only when the content is programmatic (computed values, per-item
  nodes), via `createElement` — never `innerHTML` (`no-unsafe-dom-html`
  enforces it). Inline style writes are reserved for values CSS cannot
  express (a computed height, a generated path); anything static
  belongs in the stylesheet, following the CSS/HTML lint rules' spirit
  even where no rule captures it.
- The webview runtime floor (es2023: no `Object.groupBy`, no iterator
  helpers, no `v` regex flag) is enforced by a scoped lint block over
  `public/`, `settings/` and `widgets/*/public/` — the tsconfig cannot
  express two runtimes in one project, and the floor has already
  caused a production incident once. A `tsconfig.webview.json`
  (target/lib ES2023) would be the stronger form, but was probed and
  refused (2026-08-06): `include` does not bound the project — tsc
  checks the import CLOSURE, and the webview-facing types import the
  drivers' type barrel, reaching node-side es2024/2025 code. Revisit
  only if webview-facing types get decoupled from driver classes
  (pure DTOs).
- TWO floors coexist, on UNRELATED engines — never let one move the
  other. The **webview** floor above is es2023 and is set by the
  phone's WebKit, which no Homey firmware can rejuvenate: it stays
  enforced by the scoped lint block, and the danger there is APIs,
  because esbuild lowers syntax but NEVER polyfills. The **node-side**
  floor is the Homey's own Node, and it is held by the manifest's
  `compatibility` declaration, NOT by a check.
- That node-side floor is a DECLARATION, deliberately. Two shipped
  incidents crashed the app at PARSE time on Homey Pro (2016-2019)
  firmwares before 13.4, which run a pre-Node-20 engine (established
  from a crash report's stack naming `ESMLoader`, a class Node renamed
  in 18.19.0): the regex `v` flag, then
  `import … with { type: 'json' }` (app 46.2.1) — the second a
  REGRESSION of an explicit fix, `files.mts` having been created in
  2024 precisely to avoid it (`e84cf041`, "Make json import compatible
  for Homey 2016") before a 2025-10 `simplify` commit deleted its
  `createRequire` fallback. A parse-level guard over the emitted build
  was built and then REFUSED (2026-08): no acorn `ecmaVersion`
  corresponds to "what Node 22.19 accepts" — es2025 is only partly
  implemented there (regex modifiers and duplicate named groups are
  Node 23, `using` is Node 24) — so any calibration is either too lax
  to catch anything or too strict, forcing rewrites of perfectly valid
  code. A guard that cannot be calibrated honestly guards nothing. The
  net is the declaration, kept aligned with the `engines` of the
  shipped dependencies (`>=22.19.0`); supporting an engine older than
  that is a product decision, not a code one, and the answer to a
  report from such a firmware is a free update. `files.mts` still reads
  its JSON through `createRequire` — not to satisfy a floor, but
  because it is the robust form and costs nothing.
- Node-side runtime APIs above the floor are therefore LEGITIMATE:
  `toSorted`/`toReversed` (Node 20), `Object.groupBy` (Node 21) and
  `Promise.withResolvers` (Node 22) all predate the declared engine.
  Never rewrite one away for compatibility — `unicorn/no-array-sort`
  mandates `toSorted` anyway, and a hand-rolled replacement is a
  readability regression for nothing.

## Tooling boundary (@olivierzal/configs)

The shared tooling lives in `@olivierzal/configs` (exact pin): the
eslint `homeyApp` preset (plugins are the package's dependencies — no
plugin devDeps here; the webview floor and the css/html/lifecycle
blocks come from the preset, parameterized by this repo's globs), the
prettier config (`"prettier"` key in package.json, no local file), the
`tsconfig/app` base and the vitest `swcPlugin`. The overlays keep ONLY
per-repo verdicts: the lint ignores (`.homeybuild/`, `coverage/`), the
`unicorn/filename-case` off (driver ids `melcloud_atw`/`melcloud_erv`
must match their folder names), the `settings/index.mts`
max-classes-per-file off, the `URLSearchParams`
`templateExpressionAllow` splice, tsconfig `outDir` and the local
`tsconfig.build.json` (its `rootDir`/`exclude` must resolve against
THIS directory, never inside node_modules — the trap the configs README
documents for `outDir`). Do not re-declare family policy locally — a
rule evaluation or version bump happens in configs, adoption is a
reviewed pin bump. The CI/audit/claude/dependabot/pr-title/zizmor
workflows are stubs calling the family reusables in OlivierZal/configs,
pinned `@<sha> # vX.Y.Z`; `validate.yml` and `publish.yml` stay local
(no reusable exists), so the composite action stays too — and installs
pass `npm-token` (the configs dependency lives on GitHub Packages,
where even reads need auth).

## Runtime boundary (@olivierzal/homey-kit)

`@olivierzal/homey-kit` (exact pin, a PRODUCTION dependency — the
manifest reader runs on the device) owns what used to be copied across
the three apps: the dirty gate and the freshness handshake
(`/webview`), the settings transport (`/settings`), the manifest reader
(`/node`), `fireAndForget`/`getErrorMessage`/`NotFoundError`/`sequential`
(root) and the
two test kernels (`/testing`). A change to any of them is a kit release
adopted here by a pin bump — never a local edit, never a re-derivation.

What stays local, by measurement rather than omission:

- `public/homey-api.mts`, the promise-native WIDGET layer (the widget
  SDK differs from the settings one) with its own `fireAndForget`,
  `runWebview` and `surfaceError`.
- `public/webview-freshness-boot.mts` — `watchWidgetFreshness`, the
  widget-side wiring that feeds the kit's `watchWebviewFreshness` the
  promise-native widget transport and the breadcrumb channel. Both
  widgets call it once; it carries the boot check, the poke
  subscription and the visibility re-check together.
- `public/dom.mts`, `public/zones.mts`, and the drivers themselves.
- `homey-override.d.ts` keeps its `declare module` block: module
  augmentation cannot be packaged. It EXTENDS the SDK interfaces and
  takes only the narrowed member signatures from the kit generics
  (`TypedManagerDrivers['getDrivers']`, `TypedManagerSettings['get' |
'set']`). Extending the SDK interface and the generic side by side
  does not work — they both declare those members, and the conflict
  silently resolves to the SDK's wider type.

Every `api.mts` (app, ata-group-setting, charts) passes the manifest URL
to `getWebviewHashes` explicitly: the kit's default resolves
`../webview-hashes.json` against its own module, which sits in
`node_modules` — only the caller knows where the bundler stamped it.
Dropping that argument silently disables the freshness handshake (the
reader fails open with an empty map).

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
- All-type exports hoist the keyword (`export type { A, B }`); mixed
  exports keep inline `type` specifiers, mirroring the inline-type-imports
  style. No shipped rule enforces the export side
  (`consistent-type-exports` tolerates inline specifiers once present;
  `import-x/consistent-type-specifier-style` covers imports only): the
  convention is maintained by hand, in review — a bespoke
  `no-restricted-syntax` selector for it was removed by decision
  (2026-07-28).

## Repo process

- Companion docs are part of a change's definition of done: whenever a
  PR changes behavior, API surface, requirements or process, the same
  PR updates the affected companion files (README.md, CONTRIBUTING.md,
  SECURITY.md, CLAUDE.md) — never a later sweep; the 2026-08 README
  audit caught exactly the drift this prevents (a shipped Home ATW
  driver absent from its README, a stale `Result` kind list).
- Every substantive wave ends with a targeted cleanup pass over its OWN
  diff — residue, history-narrating comments, orphaned helpers, missed
  factorings — before it is considered releasable. Sequence features
  first, cleanup second, so the pass covers them; a cleanup run before
  the last change leaves that change unswept.

- `@olivierzal/melcloud-api` is pinned EXACTLY, never with a caret: the
  library's breaking changes are self-published, adoption is an explicit
  reviewed PR per release, and a caret is what silently held heatzy-api's
  published auth fix away from its app for six days (2026-08). The
  library's own Releasing doctrine mirrors this from the publisher side.
- `main` is protected (PRs only, squash merges, 6 required contexts,
  `strict=false`); merge queue is impossible (user-owned repo, org-only
  feature).
- The PR title IS the commit that lands: `squash_merge_commit_title` is
  `PR_TITLE` on all five repos, so the title is the single source (under
  the former `COMMIT_OR_PR_TITLE`, a one-commit PR silently took its
  commit subject instead). It must follow Conventional Commits, which
  the required `PR title` check enforces
  (`.github/workflows/pr-title.yml`, byte-identical in the five). The
  default type set is the convention's own — no custom list, no scope
  allowlist (house scopes are free-form), and deliberately no
  `subjectPattern`: subjects legitimately open on a proper noun
  (`feat: MELCloud Home frost protection`). Dependabot's prefixes are
  pinned to `build(deps)` / `build(deps-dev)` in `dependabot.yml`
  rather than inferred — left to infer, it read each repo's history and
  landed a different style per repo (`Build(deps): Bump …` here,
  bare `Bump …` there). No commitlint: in squash-only repos the title
  check already covers everything that reaches `main`.
- After every push, monitor the triggered pipelines to completion — the
  PR checks after a push, the publish run after a release tag — and act
  on the outcome: rerun transient infra failures (a SonarCloud 504 is
  not a finding), fix real ones. Work is not done while its pipeline is
  red or unwatched.
- Copilot reviews every PR, and every review thread (Copilot or human)
  must end RESOLVED: with a code change when the point holds, or with a
  reasoned reply when it does not — verify claims against sources
  before acting either way (Copilot has been wrong about library
  semantics). Resolve the thread once settled; none left dangling.
- SonarCloud must be spotless for a PR to merge — and the quality gate
  passing is necessary, NOT sufficient: the free-tier gate tolerates
  3 % duplication on new code, lets code smells through, and cannot be
  customized, so the real bar is ours, held in review. That bar is
  zero on BOTH windows — new code and overall alike: zero open issues
  of every kind (bugs, code smells, vulnerabilities) across the whole
  project, 0 % duplicated lines across the whole codebase, and 100 %
  coverage (within the exclusions `sonar-project.properties`
  declares). A Sonar finding is handled like a lint error — the code
  adapts, or the divergence is settled as a documented verdict (e.g.
  the `Number.NaN` convention in `eslint.config.ts`) — never merged
  over.
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
  via athombv's action. `update-version.yml` is deleted
  debt (it committed directly to `main`, which the ruleset forbids) —
  never restore it; the PR + release flow above replaces it.
- Store submissions: a rejected version number cannot be resubmitted —
  bump the patch version.
