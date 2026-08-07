import { type Surface, analyzeRouteGuards } from '@olivierzal/homey-kit/testing'
import { describe, expect, it } from 'vitest'

// The call-site half of the API contract: each webview may only call
// routes its own manifest declares. Paths are extracted from the
// sources — literal ones exactly, template-built ones by their fixed
// chunks — and checked against the declared table. The declaration half
// (manifest ids ↔ handlers, both directions, type level) lives in
// api-contract.test.ts.
//
// The EXTRACTION is single-sourced in @olivierzal/homey-kit/testing
// (`analyzeRouteGuards`); what stays here is this app's table and the
// assertions it must satisfy, so the suite this file declares is
// readable as tests — by a reader and by the analyzer alike.
const SURFACES: readonly Surface[] = [
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
]

describe('api route guards', () => {
  describe.each(SURFACES)('$name', (surface) => {
    it('should declare every path its webview sources call', async () => {
      const { undeclaredPaths } = await analyzeRouteGuards(surface)

      expect(undeclaredPaths).toStrictEqual([])
    })

    it('should declare every method its webview sources call each path with', async () => {
      const { undeclaredMethodCalls } = await analyzeRouteGuards(surface)

      expect(undeclaredMethodCalls).toStrictEqual([])
    })

    it('should declare a route of the same method for every template-built call', async () => {
      const { undeclaredTemplateCalls } = await analyzeRouteGuards(surface)

      expect(undeclaredTemplateCalls).toStrictEqual([])
    })

    // Both checks above pass vacuously on a call the extractors cannot
    // read, which is how the verb went unchecked in the first place.
    // Accounting for every call site — parsed, or handing over a path it
    // does not spell — turns that silence into a failure, and subsumes
    // any "the extractor still matches something" clause: a regex that
    // stopped matching leaves its calls counted here and nowhere else.
    it('should account for every helper call site in its own sources', async () => {
      const { accountedCallSites, parsedOrIndirectCalls } =
        await analyzeRouteGuards(surface)

      expect(accountedCallSites).toBeGreaterThan(0)
      expect(parsedOrIndirectCalls).toBeGreaterThanOrEqual(accountedCallSites)
    })
  })
})
