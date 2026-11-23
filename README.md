# MELCloud for Homey

A [Homey](https://homey.app/) app for controlling Mitsubishi Electric HVAC devices via [MELCloud](https://app.melcloud.com/) and [MELCloud Home](https://melcloudhome.com/). The Homey App Store lists it as [MELCloud & MELCloud Home](https://homey.app/a/com.mecloud).

[![License](https://img.shields.io/github/license/OlivierZal/com.melcloud)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/com.melcloud?sort=semver)](https://github.com/OlivierZal/com.melcloud/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/com.melcloud/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/com.melcloud/actions/workflows/ci.yml)
[![Validate](https://img.shields.io/github/actions/workflow/status/OlivierZal/com.melcloud/validate.yml?branch=main&label=Validate)](https://github.com/OlivierZal/com.melcloud/actions/workflows/validate.yml)
[![CodeQL](https://github.com/OlivierZal/com.melcloud/actions/workflows/github-code-scanning/codeql/badge.svg)](https://github.com/OlivierZal/com.melcloud/actions/workflows/github-code-scanning/codeql)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_com.melcloud&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_com.melcloud)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_com.melcloud&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_com.melcloud&metric=coverage)

## Supported devices

The app adds five kinds of device to Homey. Each kind's name starts with \[Classic\] or \[Home\]: \[Classic\] for a unit registered with MELCloud Classic, the app's name for Mitsubishi Electric's original MELCloud service, \[Home\] for one registered with MELCloud Home. Not sure which one you have? MELCloud Classic is the account you use in Mitsubishi Electric's MELCloud app and at [app.melcloud.com](https://app.melcloud.com/); MELCloud Home is the one you use in its MELCloud Home app and at [melcloudhome.com](https://melcloudhome.com/).

- "\[Classic\] Air-to-air heat pump": an air conditioner, with its outdoor temperature and its energy use by mode.
- "\[Classic\] Air-to-water heat pump": one or two zones and the hot water tank, with flow temperatures, energy use and CoP.
- "\[Classic\] Energy recovery ventilator (ERV)": a ventilation unit, with CO₂ and PM2.5 readings when it has the sensors.
- "\[Home\] Air-to-air heat pump": an air conditioner, with its energy use when the unit reports it.
- "\[Home\] Air-to-water heat pump": one or two zones and the hot water tank, with energy use and CoP when the unit reports them.

## Features

### Control and monitoring

What a device shows depends on its unit (a second zone, cooling, a hot water tank, sensors) and on the values switched on in its settings.

- **Air-to-air heat pumps.** You set "Turned on", "Target temperature", "Thermostat mode" (Automatic, Cool, Dry, Fan, Heat, Off), "Fan speed" (0 means automatic, on units with an automatic speed), "Vertical vane" and "Horizontal vane", and you read "Temperature". \[Classic\] devices also show "Outdoor temperature", "Current fan speed" and "Silent mode".
- **Air-to-water heat pumps.** You set "Turned on" and, for each zone, a "Target temperature" and a "Thermostat mode" (Indoor temperature, Fixed flow temperature or Weather compensation curve, plus cooling variants of the first two on a unit that can cool), as well as "Hot water mode" (Automatic, Forced) and "Hot water target temperature". You read the room and hot water temperatures, and an "Operational state" for the unit, for domestic hot water and for each zone. \[Classic\] devices add the flow target temperatures, the outdoor, flow and return temperatures and "Frequency".
- **Energy recovery ventilators.** You set "Turned on", "Thermostat mode" (Automatic, Bypass, Energy Recovery, Off) and "Fan speed", and you read "Temperature", "Outdoor temperature", "CO₂" and "PM2.5".

### Flow cards

Homey's own cards for on/off, target temperature, thermostat mode, fan speed, hot water mode, operational state, temperature and power work with these devices; an ERV device has no others. The app adds its own:

- **Air-to-air heat pumps.** The vertical and the horizontal vane each have a When card ("The vertical vane changed"), an And card ("The vertical vane is/is not …") and a Then card ("Set the vertical vane"). \[Classic\] devices add "The current fan speed changed" and, for the silent mode, "turned on", "turned off" and "is on/off" cards.
- **Air-to-water heat pumps.** When and And cards for the operational state of domestic hot water, of zone 1 and of zone 2, and for the thermostat mode in zone 2. Then: "Set the hot water temperature", "Set the temperature in zone 2", "Set the mode in zone 2". \[Classic\] devices add "Set the flow temperature" and "Set the cool flow temperature" (each also "in zone 2"), and "turned on", "turned off" and "is on/off" cards for each on/off indicator, such as the booster heaters and the defrost mode.
- **Holiday mode**, not tied to a device: you pick a building, a floor, an area or a single unit. And: "Holiday mode is enabled/disabled". Then: "Set holiday mode" for a number of days (0 turns it off), "Set holiday mode with an end time", "Turn off holiday mode". A holiday set by a card starts at once and ends the given number of calendar days after today, at 00:00 or at the end time you give.

### Widgets

- "Air-to-air device setting": sets the on/off state, target temperature, fan speed, vanes and mode of one air-to-air unit, or of all those of a building, a floor or an area at once.
- "MELCloud History": charts of what MELCloud recorded for a unit (operational states, temperatures, signal strength and the energy report), over 1 to 365 days for the charts that span days. The charts on offer depend on the unit.

### App settings

The app's settings page lets you:

- sign in to MELCloud Home, to MELCloud Classic or to both under "Credentials", and sign an account out with "Reset";
- read the "Error history": the errors MELCloud recorded for your units since the date you pick;
- under "All device settings", apply "Disable shutdown from Homey" and "Display signal strength" to every device at once, and set the display options of all the \[Classic\] air-to-air or air-to-water heat pumps at once;
- under "Zone and device settings", set holiday mode, frost protection and, for MELCloud Home air-to-air units, overheat protection on a building, a floor, an area or a single unit;
- once you have an air-to-air device, open the store page of [MELCloud extension](https://homey.app/a/com.mecloud.extension), an optional companion app that keeps cooling within 8 °C of the outdoor temperature.

### Device settings

- "Disable shutdown from Homey": the device's own controls and Flow cards can no longer switch it off, and switching the setting on switches the device on. The "Air-to-air device setting" widget does not switch it off either: a switch-off that would reach it is refused as a whole, with a message that names the device. The remote control and the unit itself can still switch it off.
- "Display signal strength": adds "Signal Strength" to the device.
- "Allow a custom status indicator", on the four heat pump kinds: lets you choose the device's status indicator in Homey, which then lists the device among heat pumps, no longer among thermostats.
- The two \[Classic\] heat pump kinds also choose which values they show: power and energy, for all modes together or for each mode, on an air-to-air heat pump; energy, produced energy and CoP, total or daily, for all modes together or by use, on an air-to-water one. On an air-to-water heat pump, "Dashboard display" shows or hides the on/off indicators and the extra temperatures, and "Using external sensors" adds the temperatures of the sensors THW6 to THW10.

### Energy and Insights

- The four heat pump kinds report "Power" and "Energy", on \[Home\] devices when the unit reports them. Air-to-water heat pumps also report "Produced power", "Produced energy" and "CoP". The "Power" value is an estimate.
- Daily values come with them on \[Home\] devices and are a choice in the settings of \[Classic\] devices, which can also split energy by mode (air-to-air) or by use (air-to-water).
- An ERV reports neither power nor energy. In Insights, the on/off indicators are logged under their own names, such as "Booster heater 1 turned on".

## Requirements

- A Homey Pro with Homey v12.9.0 or later. The app does not run on Homey Cloud.
- A MELCloud Classic account, a MELCloud Home account or both, with the email address and password you use in Mitsubishi Electric's own app. A MELCloud Home account created with Sign in with Apple or Google has no password the app can use.
- Units already registered in that account: the app adds what the account lists.
- Internet access: the app reaches your units through Mitsubishi Electric's MELCloud service, not over your local network.

## Getting started

1. Install [MELCloud & MELCloud Home](https://homey.app/a/com.mecloud) from the Homey App Store.
2. Add a device and pick the kind that matches your unit and its service: a \[Classic\] kind for MELCloud Classic, a \[Home\] kind for MELCloud Home.
3. Sign in with the email address and password of that account when asked, then select your units.

If you have both accounts, repeat steps 2 and 3 with a device kind of the other service: each account signs in separately. You can also sign in, or sign in again later, from the app settings or by repairing a device.

## Good to know

- The app reads your units from MELCloud every minute on MELCloud Home and every 5 minutes on MELCloud Classic: a change made on the remote control or in Mitsubishi Electric's own app shows in Homey at the next reading.
- On MELCloud Classic, the energy totals are read once a night, between 01:30 and 01:55, so a day's consumption is added to them the night after. The daily values of a \[Classic\] air-to-water heat pump are those of the day before.
- Moved from MELCloud Classic to MELCloud Home? Sign in to your MELCloud Home account and add your units again as \[Home\] devices.
- When both accounts list a building under the same name, the app treats the two as one house: the app settings, the holiday mode cards and the "Air-to-air device setting" widget show it once. A change sent to the house reaches both accounts, and each unit stays selectable on its own. A Flow already saved on one account's building keeps that building: pick the house in the card to cover both.

## Supported languages

Arabic, Danish, Dutch, English, French, German, Italian, Korean, Norwegian, Polish, Russian, Spanish, Swedish.

## Help and feedback

Ask questions and share feedback in the [Homey Community topic](https://community.homey.app/t/73094). Report a problem or request a feature on the [issues page](https://github.com/OlivierZal/com.melcloud/issues). To report a security vulnerability, follow [SECURITY.md](SECURITY.md).

## Contributing

To work on the app itself, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Disclaimer

This app is not endorsed, verified or approved by Mitsubishi Electric Corporation. Mitsubishi cannot be held liable for any claims or damages that may occur when using this app to control MELCloud devices.

## License

[GPL-3.0-only](LICENSE) © Olivier Zalmanski
