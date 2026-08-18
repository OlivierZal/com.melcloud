# Contributing

Thanks for considering a contribution. This document describes the local
workflow expected before opening a pull request.

## Prerequisites

- Node.js matching `engines.node` in [`package.json`](package.json) —
  currently `^22.22.2 || >=24.15.0`, the **development** floor derived
  from the installed tree, not the floor the device runs
- npm 10+
- A GitHub personal access token with the `read:packages` scope, exported
  as `NODE_AUTH_TOKEN` — [`.npmrc`](.npmrc) reads that variable to fetch
  the `@olivierzal` packages from GitHub Packages
- A Homey Pro to install onto, for anything touching a webview

## Setup

```sh title="setup"
git clone https://github.com/OlivierZal/com.melcloud.git
cd com.melcloud
npm ci
```

## Local checks

Run the full suite before pushing — CI runs all of it, and each step has
caught failures the others miss:

```sh title="checks"
npm run format          # prettier --check (npm run format:fix to write)
npm run lint            # ESLint, including CSS and HTML
npm run typecheck       # native tsc --noEmit
npm test                # vitest run
npm run test:coverage   # must remain at 100% on all four axes
npm run build           # esbuild bundles + tsc emit, both into .homeybuild
npm run homey:validate  # Homey validation at publish level
```

`typecheck` and `build` call the native TypeScript 7 compiler by its
explicit path (`node ./node_modules/@typescript/native/bin/tsc`). Leave
it explicit: `tsc` and `tsc6` on the `PATH` are the TypeScript 6 compat
package, so a shortened script would check against the wrong compiler.

`npm run homey:validate` **may rewrite files** — `app.json` and
`locales/*.json` are generated. If it touches anything, amend before
pushing.

## Generated files are not sources

[`.homeycompose/`](.homeycompose) is the source for `app.json` and
`locales/*.json`. The Homey CLI regenerates those outputs on every
preprocess and writes them **without a trailing newline**. Commit the
CLI-generated form verbatim; never edit a generated file directly, and
never "fix" the missing newline.

## The published app id carries a typo, deliberately

The app ships as `com.mecloud` — the original submission's misspelling,
now load-bearing. The id is the app's platform identity: pairing, the
install base and the inter-app API all key on it, so republishing under
the corrected spelling would create a new app and orphan every paired
device. Everything derived keeps the typo, including the store URL. Never
add the missing `l`, in the manifest, the code or the docs.

## Two runtimes, two floors

Node-side code follows `engines.node` and may use modern APIs freely.

Webview code — [`settings/`](settings), [`public/`](public),
`widgets/*/public/` and [`types/widgets.mts`](types/widgets.mts),
which ships into the charts bundle — runs on **phone browser engines**,
not on the Homey. Its ceiling is **es2023**, derived from the Homey
mobile app's own iOS 16.4 minimum (App Store, 2026-08-11): an app only
ever gets the system WebKit, and iOS 16.4's has none of es2024. The
lint enforces that ceiling on exactly those paths. esbuild lowers
syntax but never polyfills APIs, so a too-recent API passes both the
lint and the compile and fails only on a user's phone. Raising one
floor never raises the other; conflating them has already caused a
production incident.

The floor the device runs is a third, distinct declaration:
`compatibility` in [`.homeycompose/app.json`](.homeycompose/app.json).

## On-device testing

```sh title="device"
npm run homey:start     # homey app run --remote
npm run homey:install
```

Any markup change that multiplies `homey-form-*` elements needs a cold
open on a real device: Homey injects a stylesheet that is not in this
repo, and a headless probe cannot see it.

## Coverage

Branches, functions, lines and statements are enforced at **100%** in
[`vitest.config.ts`](vitest.config.ts). New code arrives with the tests
that keep those thresholds green. A test that cannot fail proves nothing
— verify by mutation that a new test breaks when the behaviour it pins
breaks.

## Commits & pull requests

- **The pull request title is the commit that lands.** Squash merging is
  the only merge method and it takes the PR title, so the title must
  follow [Conventional Commits](https://www.conventionalcommits.org).
  A required check enforces it.
- Companion docs are part of a change's definition of done: a pull
  request that changes behaviour, API surface, requirements or process
  updates [`README.md`](README.md), this file,
  [`SECURITY.md`](SECURITY.md) and [`CLAUDE.md`](CLAUDE.md) in the same
  pull request — never in a later sweep.
- All required checks must pass, and every review thread must end
  resolved: with a change when the point holds, or with a reasoned reply
  when it does not.

## Releases

Store releases are cut through a pull request: write the user-facing
entry into `.homeychangelog.json` under the new version key **in all 13
locales**, bump `version` in `.homeycompose/app.json`, align
`package.json` with `npm version X.Y.Z --no-git-tag-version`, then run
`npm run homey:validate` to regenerate `app.json`. Once merged, tag
`vX.Y.Z` and publish a GitHub release — that is what pushes the app to
the store.

A changelog entry is **deliberately non-exhaustive**: it addresses the
user, so tooling, refactors and test work stay out of it. A rejected
version number cannot be resubmitted; bump the patch instead.
