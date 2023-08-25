const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const airbnbBestPractices = require('eslint-config-airbnb-base/rules/best-practices')
const airbnbErrors = require('eslint-config-airbnb-base/rules/errors')
const airbnbES6 = require('eslint-config-airbnb-base/rules/es6')
const airbnbImports = require('eslint-config-airbnb-base/rules/imports')
const airbnbNode = require('eslint-config-airbnb-base/rules/node')
const airbnbStrict = require('eslint-config-airbnb-base/rules/strict')
const airbnbStyle = require('eslint-config-airbnb-base/rules/style')
const airbnbVariables = require('eslint-config-airbnb-base/rules/variables')
const prettier = require('eslint-config-prettier')
const importPlugin = require('eslint-plugin-import')
const globals = require('globals')

airbnbES6.languageOptions = {
  parserOptions: airbnbES6.parserOptions,
}
delete airbnbES6.env
delete airbnbES6.parserOptions

airbnbImports.languageOptions = {
  parserOptions: airbnbImports.parserOptions,
}
delete airbnbImports.env
delete airbnbImports.parserOptions
delete airbnbImports.plugins

delete airbnbNode.env

const jsCustomRules = {
  'no-bitwise': 'off',
  'no-underscore-dangle': [
    'error',
    {
      allow: ['__'],
    },
  ],
}
const tsCustomRules = {
  '@typescript-eslint/consistent-type-exports': [
    'error',
    { fixMixedExportsWithInlineTypeSpecifier: true },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/no-explicit-any': [
    'error',
    {
      ignoreRestArgs: true,
    },
  ],
  '@typescript-eslint/no-unsafe-argument': 'off',
  '@typescript-eslint/no-unsafe-assignment': 'off',
  '@typescript-eslint/no-unsafe-call': 'off',
  '@typescript-eslint/no-unsafe-member-access': 'off',
  '@typescript-eslint/no-unsafe-return': 'off',
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      varsIgnorePattern: 'onHomeyReady',
    },
  ],
  'import/extensions': [
    'error',
    'ignorePackages',
    {
      js: 'ignorePackages',
      jsx: 'ignorePackages',
      mjs: 'ignorePackages',
      cjs: 'ignorePackages',
      ts: 'never',
      tsx: 'never',
      mts: 'never',
      cts: 'never',
    },
  ],
  'import/no-duplicates': ['error', { 'prefer-inline': true }],
}

module.exports = [
  {
    ignores: ['.homeybuild/'],
  },
  airbnbBestPractices,
  airbnbErrors,
  airbnbNode,
  airbnbStyle,
  airbnbVariables,
  airbnbES6,
  airbnbImports,
  airbnbStrict,
  {
    files: ['eslint.config.js'],
    rules: {
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs['strict-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,
      ...tsCustomRules,
    },
  },
  importPlugin.configs.typescript,
  {
    rules: jsCustomRules,
  },
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.node,
      },
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
      },
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },
]
