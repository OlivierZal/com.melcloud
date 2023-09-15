/* eslint-disable import/no-extraneous-dependencies */
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const {
  extends: airbnbRules,
  ...airbnbConfig
} = require('eslint-config-airbnb-base')
const prettier = require('eslint-config-prettier')
const importPlugin = require('eslint-plugin-import')
const envs = require('globals')

const envMapping = {
  es6: 'es2015',
  node: 'node',
}

function convertIntoEslintFlatConfig(config) {
  const { env, globals, plugins, parserOptions, ...oldConfig } = config
  return {
    ...oldConfig,
    languageOptions: {
      ...('env' in config && {
        globals: Object.fromEntries(
          Object.keys(env)
            .filter(
              (key) => env[key] && key in envMapping && envMapping[key] in envs,
            )
            .flatMap((key) => Object.entries(envs[envMapping[key]])),
        ),
        ...('parserOptions' in config && {
          parserOptions,
        }),
      }),
    },
  }
}

const customRules = {
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
  '@typescript-eslint/no-unused-vars': [
    'error',
    {
      varsIgnorePattern: 'onHomeyReady',
    },
  ],
  'import/extensions': 'off',
  'import/no-duplicates': ['error', { 'prefer-inline': true }],
}

module.exports = [
  {
    ignores: ['.homeybuild/'],
  },
  // eslint-disable-next-line global-require, import/no-dynamic-require
  ...airbnbRules.map((rule) => convertIntoEslintFlatConfig(require(rule))),
  convertIntoEslintFlatConfig(airbnbConfig),
  {
    rules: customRules,
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs['strict-type-checked'].rules,
      ...tsPlugin.configs['stylistic-type-checked'].rules,
      ...tsCustomRules,
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
  },
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
