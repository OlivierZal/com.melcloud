import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import airbnbBestPractices from 'eslint-config-airbnb-base/rules/best-practices'
import airbnbErrors from 'eslint-config-airbnb-base/rules/errors'
import airbnbES6 from 'eslint-config-airbnb-base/rules/es6'
import airbnbImports from 'eslint-config-airbnb-base/rules/imports'
import airbnbNode from 'eslint-config-airbnb-base/rules/node'
import airbnbStrict from 'eslint-config-airbnb-base/rules/strict'
import airbnbStyle from 'eslint-config-airbnb-base/rules/style'
import airbnbVariables from 'eslint-config-airbnb-base/rules/variables'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'

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

delete importPlugin.configs.recommended.parserOptions
delete importPlugin.configs.recommended.plugins

const tsDisabledRules = {
  'no-bitwise': 'off',
  'no-underscore-dangle': [
    'error',
    {
      allow: ['__'],
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
}

export default [
  {
    ignores: ['.homeybuild/'],
  },
  airbnbBestPractices,
  airbnbErrors,
  airbnbNode,
  airbnbStyle,
  airbnbVariables,
  airbnbES6,
  {
    ...airbnbImports,
    files: ['**/*.js'],
  },
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
  airbnbStrict,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs['strict-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,
      ...tsDisabledRules,
    },
  },
  importPlugin.configs.recommended,
  importPlugin.configs.typescript,
  {
    languageOptions: {
      ecmaVersion: 'latest',
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
  prettier,
]
