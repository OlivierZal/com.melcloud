import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
// @ts-expect-error: `eslint-plugin-import` is not typed
import importPlugin from 'eslint-plugin-import'
import packageJson from 'eslint-plugin-package-json/configs/recommended'
import perfectionist from 'eslint-plugin-perfectionist'
import ts, { configs as tsConfigs } from 'typescript-eslint'

import type { Linter as TSLinter } from '@typescript-eslint/utils/ts-eslint'
import type { Linter } from 'eslint'

const { flatConfigs: importPluginConfigs } = importPlugin as {
  flatConfigs: {
    errors: Linter.Config
    typescript: Linter.Config & {
      settings: Record<string, unknown> & {
        'import/resolver': Record<string, unknown>
      }
    }
  }
}

const modifiersOrder = [
  ['declare', 'override', ''],
  ['static', '', 'abstract'],
  ['decorated', ''],
  ['', 'protected', 'private'],
  ['', 'optional'],
  ['readonly', ''],
]

const selectorOrder = [
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

const cartesianProduct = (arrays: string[][]): string[][] =>
  arrays.reduce<string[][]>(
    (acc, array) =>
      acc.flatMap((accItem) =>
        array.map((item) => [
          ...(Array.isArray(accItem) ? accItem : [accItem]),
          item,
        ]),
      ),
    [[]],
  )

const allModifierCombos = cartesianProduct(modifiersOrder).map((combo) =>
  combo.filter((modifier) => modifier !== ''),
)

const modifierIncompatibilities = {
  abstract: ['decorated', 'private', 'static'],
  declare: ['decorated', 'override'],
}

const compatibleModifierCombos = allModifierCombos.filter((combo) =>
  combo.every((modifier) =>
    (modifier in modifierIncompatibilities ?
      modifierIncompatibilities[
        modifier as keyof typeof modifierIncompatibilities
      ]
    : []
    ).every((incompatibleModifier) => !combo.includes(incompatibleModifier)),
  ),
)

const allModifiers = [
  'abstract',
  'declare',
  'decorated',
  'optional',
  'override',
  'private',
  'protected',
  'readonly',
  'static',
]
const baseMethodIncompatibilities = ['declare', 'readonly']
const accessorIncompatibilities = [...baseMethodIncompatibilities, 'optional']

const selectorIncompatibilities = {
  'accessor-property': accessorIncompatibilities,
  constructor: [
    ...baseMethodIncompatibilities,
    'abstract',
    'decorated',
    'optional',
    'override',
    'static',
  ],
  'event-handler': allModifiers,
  'function-property': ['abstract', 'declare'],
  'get-method': accessorIncompatibilities,
  'index-signature': [
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'private',
    'protected',
  ],
  method: baseMethodIncompatibilities,
  property: [],
  'set-method': accessorIncompatibilities,
  'static-block': allModifiers,
}

const generateGroupsForSelector = (selector: string): string[] =>
  compatibleModifierCombos
    .filter((modifiers) =>
      modifiers.every(
        (modifier) =>
          !(
            selector in selectorIncompatibilities ?
              selectorIncompatibilities[
                selector as keyof typeof selectorIncompatibilities
              ]
            : []).includes(modifier),
      ),
    )
    .map((modifiers) => [...modifiers, selector].join('-'))

const groups = selectorOrder.flatMap((selector): (string | string[])[] => {
  if (Array.isArray(selector)) {
    const groupPairs = selector.map((pairedSelector) =>
      generateGroupsForSelector(pairedSelector),
    )
    const [groupPair] = groupPairs
    return [...Array(groupPair.length).keys()].map((index: number) =>
      groupPairs.map((group) => group.at(index) ?? ''),
    )
  }
  return generateGroupsForSelector(selector)
})

const classGroups = {
  customGroups: [
    {
      elementNamePattern: 'on*',
      groupName: 'event-handler',
      selector: 'method',
    },
  ],
  groups,
}

const importGroups = {
  groups: [
    'side-effect',
    'side-effect-style',
    'builtin',
    'external',
    'internal',
    'parent',
    'sibling',
    'index',
    'object',
    'style',
    'unknown',
    'builtin-type',
    'external-type',
    'internal-type',
    'parent-type',
    'sibling-type',
    'index-type',
    'type',
  ],
}

const typeGroups = {
  groups: [
    'import',
    'keyword',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'conditional',
    'operator',
    'unknown',
    'nullish',
  ],
}

const requiredFirst = {
  groupKind: 'required-first',
}

const valuesFirst = {
  groupKind: 'values-first',
}

const config = [
  {
    ignores: ['.homeybuild/'],
  },
  ...ts.config(
    {
      extends: [
        js.configs.all,
        ...tsConfigs.all,
        ...tsConfigs.strictTypeChecked,
        importPluginConfigs.errors,
        importPluginConfigs.typescript,
        prettier,
      ],
      files: ['**/*.{ts,mts,js}'],
      languageOptions: {
        ecmaVersion: 'latest',
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.js'],
          },
          tsconfigRootDir: import.meta.dirname,
          warnOnUnsupportedTypeScriptVersion: false,
        },
        sourceType: 'module',
      },
      linterOptions: {
        reportUnusedDisableDirectives: true,
      },
      plugins: {
        '@stylistic': stylistic,
        perfectionist,
      },
      rules: {
        '@stylistic/line-comment-position': 'error',
        '@stylistic/lines-around-comment': 'error',
        '@stylistic/lines-between-class-members': ['error', 'always'],
        '@stylistic/multiline-comment-style': 'error',
        '@stylistic/quotes': [
          'error',
          'single',
          {
            allowTemplateLiterals: false,
            avoidEscape: true,
            ignoreStringLiterals: false,
          },
        ],
        '@stylistic/spaced-comment': [
          'error',
          'always',
          {
            block: {
              balanced: true,
            },
          },
        ],
        '@typescript-eslint/consistent-return': 'off',
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            filter: {
              match: true,
              regex: '^EnergyReport(Regular|Total)$',
            },
            format: null,
            selector: 'property',
          },
          {
            filter: {
              match: true,
              regex:
                '^[a-z]+(?:_[a-z0-9]+)*\\.(?:[a-z0-9]+_)*(([a-z0-9]+|zone(1|2)))?$',
            },
            format: null,
            selector: ['objectLiteralProperty', 'typeProperty'],
          },
          {
            format: ['camelCase', 'PascalCase', 'snake_case'],
            selector: ['objectLiteralProperty', 'typeProperty'],
          },
          {
            format: ['camelCase', 'PascalCase'],
            selector: 'import',
          },
          {
            format: ['PascalCase'],
            prefix: ['can', 'did', 'has', 'is', 'should', 'will'],
            selector: 'variable',
            types: ['boolean'],
          },
          {
            format: ['UPPER_CASE'],
            modifiers: ['const', 'global'],
            selector: 'variable',
            types: ['boolean', 'number', 'string'],
          },
          {
            format: ['PascalCase'],
            selector: 'typeLike',
          },
          {
            format: ['camelCase'],
            leadingUnderscore: 'allow',
            selector: 'default',
          },
        ],
        '@typescript-eslint/no-dupe-class-members': 'off',
        '@typescript-eslint/no-explicit-any': [
          'error',
          {
            ignoreRestArgs: true,
          },
        ],
        '@typescript-eslint/no-invalid-this': 'off',
        '@typescript-eslint/no-magic-numbers': [
          'error',
          {
            ignoreEnums: true,
          },
        ],
        '@typescript-eslint/no-redeclare': 'off',
        '@typescript-eslint/no-unnecessary-condition': [
          'error',
          {
            checkTypePredicates: true,
          },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_context$',
            varsIgnorePattern: '^onHomeyReady$',
          },
        ],
        '@typescript-eslint/prefer-destructuring': [
          'error',
          {
            array: true,
            object: true,
          },
          {
            enforceForDeclarationWithTypeAnnotation: true,
            enforceForRenamedProperties: true,
          },
        ],
        '@typescript-eslint/prefer-readonly-parameter-types': 'off',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/typedef': 'off',
        camelcase: 'off',
        curly: 'error',
        'import/first': 'error',
        'import/max-dependencies': [
          'error',
          {
            ignoreTypeImports: true,
          },
        ],
        'import/newline-after-import': 'error',
        'import/no-absolute-path': 'error',
        'import/no-anonymous-default-export': 'error',
        'import/no-cycle': 'error',
        'import/no-default-export': 'error',
        'import/no-deprecated': 'error',
        'import/no-duplicates': 'error',
        'import/no-dynamic-require': 'error',
        'import/no-empty-named-blocks': 'error',
        'import/no-extraneous-dependencies': 'error',
        'import/no-import-module-exports': 'error',
        'import/no-mutable-exports': 'error',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',
        'import/no-named-default': 'error',
        'import/no-namespace': 'error',
        'import/no-relative-packages': 'error',
        'import/no-self-import': 'error',
        'import/no-unassigned-import': [
          'error',
          {
            allow: ['source-map-support/register.js', 'core-js/actual/**'],
          },
        ],
        'import/no-unused-modules': 'error',
        'import/no-useless-path-segments': 'error',
        'import/no-webpack-loader-syntax': 'error',
        'import/unambiguous': 'error',
        'max-lines': 'off',
        'no-bitwise': 'off',
        'no-else-return': [
          'error',
          {
            allowElseIf: false,
          },
        ],
        'no-empty': [
          'error',
          {
            allowEmptyCatch: true,
          },
        ],
        'no-ternary': 'off',
        'no-undefined': 'off',
        'no-underscore-dangle': [
          'error',
          {
            allow: ['__'],
          },
        ],
        'one-var': ['error', 'never'],
        'perfectionist/sort-array-includes': 'error',
        'perfectionist/sort-classes': ['error', classGroups],
        'perfectionist/sort-enums': 'error',
        'perfectionist/sort-exports': ['error', valuesFirst],
        'perfectionist/sort-imports': ['error', importGroups],
        'perfectionist/sort-interfaces': ['error', requiredFirst],
        'perfectionist/sort-intersection-types': ['error', typeGroups],
        'perfectionist/sort-maps': 'error',
        'perfectionist/sort-named-exports': ['error', valuesFirst],
        'perfectionist/sort-named-imports': ['error', valuesFirst],
        'perfectionist/sort-object-types': ['error', requiredFirst],
        'perfectionist/sort-objects': 'error',
        'perfectionist/sort-sets': 'error',
        'perfectionist/sort-switch-case': 'error',
        'perfectionist/sort-union-types': ['error', typeGroups],
        'sort-imports': 'off',
        'sort-keys': 'off',
      },
      settings: {
        perfectionist: {
          ignoreCase: false,
          order: 'asc',
          partitionByComment: true,
          type: 'natural',
        },
        ...importPluginConfigs.typescript.settings,
        'import/resolver': {
          ...importPluginConfigs.typescript.settings['import/resolver'],
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
    },
    {
      extends: [tsConfigs.disableTypeChecked],
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      files: [
        '**/*.config.{ts,js}',
        '**/api.mts',
        'app.mts',
        'drivers/*/{device,driver}.mts',
      ],
      rules: {
        'import/no-default-export': 'off',
        'import/prefer-default-export': [
          'error',
          {
            target: 'any',
          },
        ],
      },
    },
    {
      files: ['eslint.config.ts'],
      rules: {
        '@typescript-eslint/naming-convention': 'off',
      },
    },
  ),
  {
    files: ['**/*.html'],
    ...html.configs['flat/recommended'],
    rules: {
      ...html.configs['flat/recommended'].rules,
      '@html-eslint/id-naming-convention': 'error',
      '@html-eslint/lowercase': 'error',
      '@html-eslint/no-abstract-roles': 'error',
      '@html-eslint/no-accesskey-attrs': 'error',
      '@html-eslint/no-aria-hidden-body': 'error',
      '@html-eslint/no-extra-spacing-text': 'error',
      '@html-eslint/no-inline-styles': 'error',
      '@html-eslint/no-multiple-empty-lines': 'error',
      '@html-eslint/no-non-scalable-viewport': 'error',
      '@html-eslint/no-positive-tabindex': 'error',
      '@html-eslint/no-script-style-type': 'error',
      '@html-eslint/no-skip-heading-levels': 'error',
      '@html-eslint/no-target-blank': 'error',
      '@html-eslint/no-trailing-spaces': 'error',
      '@html-eslint/require-button-type': 'error',
      '@html-eslint/require-frame-title': 'error',
      '@html-eslint/require-meta-charset': 'error',
      '@html-eslint/require-meta-description': 'error',
      '@html-eslint/require-meta-viewport': 'error',
      '@html-eslint/sort-attrs': 'error',
    },
  },
  {
    files: ['**/*.json'],
    ignores: [
      '**/package-lock.json',
      '**/package.json',
      'app.json',
      'locales/*.json',
    ],
    language: 'json/json',
    ...(json.configs as Record<string, Linter.Config>).recommended,
  },
  {
    files: ['**/*.md'],
    language: 'markdown/gfm',
    plugins: {
      markdown,
    },
    rules: {
      ...(markdown.configs as Record<string, Linter.Config>).recommended.rules,
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
    },
  },
  packageJson,
] satisfies (Linter.Config | TSLinter.ConfigType)[]

export default config
