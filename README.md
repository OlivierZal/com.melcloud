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

## Disclaimer

This app is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this app to control MELCloud devices.

## License

GPL-3.0-only
