const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const {
  extends: airbnbRules,
  ...airbnbConfig
} = require('eslint-config-airbnb-base')
const prettier = require('eslint-config-prettier')
const importPlugin = require('eslint-plugin-import')
const globals = require('globals')

const envs = {
  es6: 'es2015',
}
const plugins = {
  import: importPlugin,
}

function convertIntoEslintFlatConfig(config) {
  const newConfig = { ...config, languageOptions: {} }
  if ('env' in newConfig) {
    newConfig.languageOptions.globals = Object.keys(newConfig.env)
      .filter((key) => newConfig.env[key] === true)
      .reduce((acc, key) => {
        if (key in globals) {
          return { ...acc, ...globals[key] }
        }
        if (key in envs && envs[key] in globals) {
          return { ...acc, ...globals[envs[key]] }
        }
        return acc
      }, {})
    delete newConfig.env
  }
  if ('parserOptions' in newConfig) {
    newConfig.languageOptions.parserOptions = newConfig.parserOptions
    delete newConfig.parserOptions
  }
  if ('plugins' in newConfig) {
    newConfig.plugins = Object.fromEntries(
      newConfig.plugins.map((plugin) => [plugin, plugins[plugin]])
    )
  }
  return newConfig
}

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
  ...airbnbRules.map((rule) => convertIntoEslintFlatConfig(require(rule))),
  convertIntoEslintFlatConfig(airbnbConfig),
  {
    rules: jsCustomRules,
  },
  {
    files: ['eslint.config.js'],
    rules: {
      'global-require': 'off',
      'import/no-dynamic-require': 'off',
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
  importPlugin.configs.typescript,
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
