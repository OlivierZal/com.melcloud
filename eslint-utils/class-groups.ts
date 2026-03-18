import { buildGroups } from './build-groups.ts'

const modifiers = [
  ['declare', ''],
  ['static', '', 'abstract'],
  ['override', ''],
  ['decorated', ''],
  ['', 'protected', 'private'],
  ['', 'optional'],
  ['readonly', ''],
]

const modifierIncompatibilities = {
  abstract: new Set(['decorated', 'private', 'static']),
  declare: new Set(['decorated', 'override']),
}

const selectors = [
  'index-signature',
  'property',
  'function-property',
  'static-block',
  'constructor',
  'accessor-property',
  ['get-method', 'set-method'],
  'event-handler',
  'method',
]

const allModifiers = new Set(modifiers.flat().filter(Boolean))
const baseMethodIncompatibilities = new Set(['declare', 'readonly'])
const accessorIncompatibilities = new Set([
  ...baseMethodIncompatibilities,
  'optional',
])
const selectorIncompatibilities = {
  'accessor-property': accessorIncompatibilities,
  constructor: new Set([
    ...baseMethodIncompatibilities,
    'abstract',
    'decorated',
    'optional',
    'override',
    'static',
  ]),
  'event-handler': allModifiers,
  'function-property': new Set(['abstract', 'declare']),
  'get-method': accessorIncompatibilities,
  'index-signature': new Set([
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'private',
    'protected',
  ]),
  method: baseMethodIncompatibilities,
  property: new Set(),
  'set-method': accessorIncompatibilities,
  'static-block': allModifiers,
}

export const classGroups = {
  customGroups: [
    {
      elementNamePattern: '^on.+',
      groupName: 'event-handler',
      selector: 'method',
    },
  ],
  groups: buildGroups({
    modifierIncompatibilities,
    modifiers,
    selectorIncompatibilities,
    selectors,
  }),
}
