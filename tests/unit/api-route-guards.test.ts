import { createRouteGuardSuite } from '@olivierzal/homey-kit/testing'

// The call-site half of the API contract: each webview may only call
// routes its own manifest declares. Paths are extracted from the
// sources — literal ones exactly, template-built ones by their fixed
// chunks — and checked against the declared table. The declaration half
// (manifest ids ↔ handlers, both directions, type level) lives in
// api-contract.test.ts. The guard itself is single-sourced in
// @olivierzal/homey-kit/testing; only the table below is this app's.

createRouteGuardSuite([
  {
    manifest: '.homeycompose/app.json',
    name: 'settings',
    sourceDirs: ['settings', 'public'],
  },
  {
    manifest: 'widgets/ata-group-setting/widget.compose.json',
    name: 'ata-group-setting widget',
    sourceDirs: ['widgets/ata-group-setting/public', 'public'],
  },
  {
    manifest: 'widgets/charts/widget.compose.json',
    name: 'charts widget',
    sourceDirs: ['widgets/charts/public', 'public'],
  },
])
