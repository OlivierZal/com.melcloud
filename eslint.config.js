/* eslint-disable @typescript-eslint/no-var-requires */
const js = require('@eslint/js')
const typescriptEslintParser = require('@typescript-eslint/parser')
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import')
const prettier = require('eslint-config-prettier')
/* eslint-enable @typescript-eslint/no-var-requires */

module.exports = [
  {
    ...js.configs.recommended,
    files: ['**/*.ts', '**/*.tsx', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      parser: typescriptEslintParser,
      parserOptions: { project: './tsconfig.json' },
      sourceType: 'module',
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      import: importPlugin,
    },
    rules: {
      ...typescriptEslintPlugin.configs['strict-type-checked'].rules,
      ...typescriptEslintPlugin.configs['stylistic-type-checked'].rules,
      ...importPlugin.configs.typescript.rules,
      ...prettier.rules,
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: 'onHomeyReady' },
      ],
    },
    settings: {
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },
]
