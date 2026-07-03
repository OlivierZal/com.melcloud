# MELCloud for Homey

A [Homey](https://homey.app/) app for controlling Mitsubishi Electric HVAC devices via [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/).

[![License](https://img.shields.io/github/license/OlivierZal/com.melcloud)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/com.melcloud?sort=semver)](https://github.com/OlivierZal/com.melcloud/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/com.melcloud/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/com.melcloud/actions/workflows/ci.yml)
[![Validate](https://img.shields.io/github/actions/workflow/status/OlivierZal/com.melcloud/validate.yml?branch=main&label=Validate)](https://github.com/OlivierZal/com.melcloud/actions/workflows/validate.yml)
[![CodeQL](https://github.com/OlivierZal/com.melcloud/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/OlivierZal/com.melcloud/actions/workflows/github-code-scanning/codeql)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_com.melcloud&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_com.melcloud)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_com.melcloud&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_com.melcloud&metric=coverage)

## Introduction

This app integrates [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/) into [Homey](https://homey.app/) to control Mitsubishi Electric HVAC devices:

### MELCloud (classic)

- **Air-to-air heat pumps** (ATA) — cooling, heating, fan speed, vane position
- **Air-to-water heat pumps** (ATW) — zones, hot water, flow temperatures
- **Energy recovery ventilators** (ERV) — ventilation modes, bypass

### MELCloud Home

- **Air-to-air heat pumps** (ATA) — cooling, heating, fan speed, vane position

## Installation

1. Install the [MELCloud app](https://homey.app/a/com.mecloud) from the Homey App Store.
2. Open the app settings and log in with your MELCloud credentials.
3. Add your devices via the pairing wizard.

## Supported languages

Arabic, Danish, Dutch, English, French, German, Italian, Korean, Norwegian, Polish, Russian, Spanish, Swedish.

## Development

Requirements: Node.js 22 (see `.nvmrc`) and the [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started) (`npx homey`).

```bash title="Common commands"
npm ci               # install dependencies
npm test             # run the test suite (vitest)
npm run typecheck    # type-check with tsgo (fast, pre-release compiler)
npm run lint         # eslint (TS, HTML, CSS, JSON, YAML, Markdown)
npm run build        # bundle browser entries (esbuild) + compile with tsc
npm run homey:start  # run the app on your Homey (remote)
```

Architecture notes:

- Browser code (both widgets' `public/` and the `settings/` page) is bundled by `scripts/bundle.mjs` into one self-contained `index.mjs` per entry; the outputs are gitignored and rebuilt by `npm run build`, which the Homey CLI runs automatically on validate/publish. Shared helpers live in `public/` and are imported directly by widgets and settings.
- The production build compiles with stable `tsc`; `npm run typecheck` uses `tsgo` (the native TypeScript preview) for speed.
- Test coverage is enforced at 100% for backend code; browser glue (`public/`, `settings/`, widget `public/`) is excluded from coverage, so the badge covers drivers, app and API layers only.

## Disclaimer

This app is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this app to control MELCloud devices.

## License

GPL-3.0-only
