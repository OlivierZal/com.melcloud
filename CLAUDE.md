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
  The committed source HTML carries NO stamps — never hand-add a `?v=`
  there, and nothing needs re-committing when a webview source changes
  (the old re-stamp-and-commit dance is gone). Stamps exist only in the
  packaged app, and only within attribute/import reference contexts,
  never comments. A second cache layer covers the HTML
  itself (phone webviews cache the page across app versions,
  force-close included): each bundle carries a freshness handshake —
  the page's identity is the document-order join of its `?v=` stamps (a CSS-only ship moves it too), `GET /webview-hashes` serves the
  live hashes (a manifest `bundle.mts` emits into the packaged app,
  read by `lib/webview-hashes.mts`; module, test
  `tests/unit/webview-hashes.test.ts` and the
  `tests/fixtures/webview-hashes/` fixtures are byte-identical in the
  three apps — edit all three together), and a mismatch triggers ONE
  refetch of the document through a never-cached address
  (`?fresh=<identity>` — a bare reload can be re-served the same stale
  document from the HTTP cache; sessionStorage guard,
  `webview-freshness.mts`), whose fresh stamps pull the fresh assets;
  a mismatch that survives its refetch is reported to
  `POST /boot-error`. The app also emits a `webview_hashes_changed`
  realtime event at its own boot; an open page re-runs the same
  handshake on it — a second trigger of the one primitive, covering a
  page left open across an app restart or update. Every failure
  path stays open: an unstamped page, an absent route or denied
  storage must never take a working webview down.
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
  `settings/callback-api.mts` is the settings pages' transport
  (the settings SDK is error-first-callback, unlike the widget SDK —
  which is why `public/homey-api.mts` stays a separate, promise-native
  widget layer); byte-identical copies live in com.heatzy and
  com.melcloud.extension — edit all three together. The surface is
  test-pinned in two halves, one file each — extend BOTH when touching
  a route: `tests/unit/api-contract.test.ts` (since #1261) pins
  manifest ids ↔ handlers both ways plus the handlers' function type,
  on all three surfaces — and like the route guard, everything below its
  own `SURFACES` table is byte-identical in the two sibling apps, only
  the table and the `Handler` union naming what each app exposes differ;
  `tests/unit/api-route-guards.test.ts` pins the
  call sites — every path a webview writes, literal or template-built,
  must match a declared route of its own surface, under a declared
  method. Everything below its `SURFACES` table is byte-identical in
  com.heatzy and com.melcloud.extension (only that table differs) —
  edit all three together. Its load-bearing clause is the call-site
  accounting: every `homeyApi*` site must be parsed or hand over a path
  it does not spell, which is what makes a broken extractor a failure
  instead of a silent pass, and what makes separate "the regex still
  matches" clauses redundant.
- Dirty-gating: `public/dirty-gate.mts` is the ONE primitive behind every
  webview Apply/Refresh pair (settings sections, frost/holiday/overheat
  panels, the credentials section, the ATA group widget) — never
  re-derive its invariant at a call site. The gate also freezes the gated
  fieldsets while a request is in flight (container `disabled` +
  `aria-busy`, so a control's own domain `disabled` survives the thaw):
  every success path rewrites the fields, so a mid-flight edit would be
  silently clobbered — pass every region `serialize` reads through
  `fieldsetElements`. When a wire protocol cannot express every form
  divergence (an emptied field means "no instruction" and is omitted
  from the request), the call site supplies `isActionable` — Apply arms
  only when the request would carry something — while `serialize` stays
  the pure snapshot; the ATA group widget arms through its body builder
  this way, and the credentials section arms only when both fields are
  filled (its Reset button rides the gate as a Refresh — greyed by busy
  alone). Its
  `serialize` must stay a PURE form snapshot, never a request-body builder
  (those filter null deltas out and desync the pristine check — the
  historical heatzy bug), and disabled greying styles
  `[class*='homey-button']:disabled` generically, never a per-class list
  (a class list silently missed renamed buttons).
  `tests/unit/dirty-gate.test.ts` locks the behavior; com.heatzy and
  com.melcloud.extension carry byte-identical copies
  (`settings/dirty-gate.mts` in each) — edit all three together.
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
  (pure DTOs). Node-side code may use the newer APIs
  freely.

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
