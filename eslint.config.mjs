import js from '@eslint/js'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import jsonc from 'eslint-plugin-jsonc'
import packageJson from 'eslint-plugin-package-json/configs/recommended'
import perfectionist from 'eslint-plugin-perfectionist'
import jsoncParser from 'jsonc-eslint-parser'
import ts from 'typescript-eslint'

const modifiersOrder = [
  ['declare', 'override', ''],
  ['static', '', 'abstract'],
  ['', 'protected', 'private'],
  ['', 'optional'],
  ['readonly', ''],
  ['decorated', ''],
]
const modifierIncompatibilityMapping = {
  abstract: ['decorated', 'private', 'static'],
  declare: ['decorated', 'override'],
}

const selectorOrder = [
  'index-signature',
  'property',
  'function-property',
  'static-block',
  'constructor',
  'accessor-property',
  ['get-method', 'set-method'],
  'method',
]
const selectorIncompatibilityMapping = {
  'accessor-property': ['declare', 'optional', 'readonly'],
  constructor: [
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'readonly',
    'static',
  ],
  'function-property': ['abstract', 'declare'],
  'get-method': ['declare', 'optional', 'readonly'],
  'index-signature': [
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'private',
    'protected',
  ],
  method: ['declare', 'readonly'],
  property: [],
  'set-method': ['declare', 'optional', 'readonly'],
  'static-block': [
    'abstract',
    'declare',
    'decorated',
    'optional',
    'override',
    'private',
    'protected',
    'readonly',
    'static',
  ],
}

const cartesianProduct = (arrays) =>
  arrays.reduce(
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

const compatibleModifierCombos = allModifierCombos.filter((combo) =>
  combo.every((modifier) =>
    (modifierIncompatibilityMapping[modifier] ?? []).every(
      (incompatibleModifier) => !combo.includes(incompatibleModifier),
    ),
  ),
)

const generateGroupsForSelector = (selector) =>
  compatibleModifierCombos
    .filter((modifiers) =>
      modifiers.every(
        (modifier) =>
          !(selectorIncompatibilityMapping[selector] ?? []).includes(modifier),
      ),
    )
    .map((modifiers) => [...modifiers, selector].join('-'))

const groups = selectorOrder.flatMap((selector) => {
  if (Array.isArray(selector)) {
    const groupPairs = selector.map((pairedSelector) =>
      generateGroupsForSelector(pairedSelector),
    )
    const [groupPair] = groupPairs
    return [...Array(groupPair.length).keys()].map((index) =>
      groupPairs.map((group) => group[index]),
    )
  }
  return generateGroupsForSelector(selector)
})

const classGroups = {
  groups,
}

const typeGroups = {
  groups: [
    'keyword',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'operator',
    'conditional',
    'import',
    'unknown',
    'nullish',
  ],
}

const requiredFirst = {
  groupKind: 'required-first',
}

const typesFirst = {
  groupKind: 'types-first',
}

export default [
  {
    ignores: ['.homeybuild/'],
  },
  ...ts.config(
    {
      extends: [
        js.configs.all,
        ...ts.configs.all,
        ...ts.configs.strictTypeChecked,
        prettier,
      ],
      files: ['**/*.ts', '**/*.mjs'],
      languageOptions: {
        parserOptions: {
          projectService: true,
          warnOnUnsupportedTypeScriptVersion: false,
        },
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
            format: ['camelCase'],
            modifiers: ['global'],
            selector: 'variable',
            types: ['function'],
          },
          {
            format: ['camelCase', 'UPPER_CASE'],
            modifiers: ['global'],
            selector: 'variable',
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
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_context$',
            caughtErrorsIgnorePattern: '^_',
            varsIgnorePattern: '^onHomeyReady$',
          },
        ],
        '@typescript-eslint/prefer-readonly-parameter-types': 'off',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/typedef': 'off',
        camelcase: 'off',
        curly: 'error',
        'max-lines': 'off',
        'no-bitwise': 'off',
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
        'perfectionist/sort-exports': ['error', typesFirst],
        'perfectionist/sort-imports': 'error',
        'perfectionist/sort-interfaces': ['error', requiredFirst],
        'perfectionist/sort-intersection-types': ['error', typeGroups],
        'perfectionist/sort-maps': 'error',
        'perfectionist/sort-named-exports': ['error', typesFirst],
        'perfectionist/sort-named-imports': ['error', typesFirst],
        'perfectionist/sort-object-types': ['error', requiredFirst],
        'perfectionist/sort-objects': 'error',
        'perfectionist/sort-sets': 'error',
        'perfectionist/sort-switch-case': 'error',
        'perfectionist/sort-union-types': ['error', typeGroups],
        'sort-imports': 'off',
        'sort-keys': 'off',
      },
    },
    {
      files: ['**/*.mjs'],
      ...ts.configs.disableTypeChecked,
      rules: {
        ...ts.configs.disableTypeChecked.rules,
        '@typescript-eslint/explicit-function-return-type': 'off',
      },
    },
    {
      settings: {
        perfectionist: {
          ignoreCase: false,
          order: 'asc',
          partitionByComment: true,
          type: 'natural',
        },
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
    files: ['**/*.json', '**/*.jsonc'],
    ignores: [
      '**/package-lock.json',
      '**/package.json',
      'app.json',
      'locales/*.json',
    ],
    languageOptions: {
      parser: jsoncParser,
    },
    plugins: {
      jsonc,
    },
    rules: {
      'jsonc/auto': 'error',
      'jsonc/key-name-casing': 'error',
      'jsonc/no-bigint-literals': 'error',
      'jsonc/no-binary-expression': 'error',
      'jsonc/no-binary-numeric-literals': 'error',
      'jsonc/no-comments': 'error',
      'jsonc/no-dupe-keys': 'error',
      'jsonc/no-escape-sequence-in-identifier': 'error',
      'jsonc/no-hexadecimal-numeric-literals': 'error',
      'jsonc/no-infinity': 'error',
      'jsonc/no-irregular-whitespace': 'error',
      'jsonc/no-multi-str': 'error',
      'jsonc/no-nan': 'error',
      'jsonc/no-number-props': 'error',
      'jsonc/no-numeric-separators': 'error',
      'jsonc/no-octal': 'error',
      'jsonc/no-octal-escape': 'error',
      'jsonc/no-octal-numeric-literals': 'error',
      'jsonc/no-parenthesized': 'error',
      'jsonc/no-plus-sign': 'error',
      'jsonc/no-regexp-literals': 'error',
      'jsonc/no-sparse-arrays': 'error',
      'jsonc/no-template-literals': 'error',
      'jsonc/no-undefined-value': 'error',
      'jsonc/no-unicode-codepoint-escapes': 'error',
      'jsonc/no-useless-escape': 'error',
      'jsonc/sort-keys': [
        'error',
        'asc',
        {
          natural: true,
        },
      ],
      'jsonc/valid-json-number': 'error',
    },
  },
  {
    files: ['**/*.compose.json', '.homeychangelog.json', '.vscode/*.json'],
    rules: {
      'jsonc/key-name-casing': 'off',
    },
  },
  packageJson,
]
