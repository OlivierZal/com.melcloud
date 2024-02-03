const globals = require('globals')
const importPlugin = require('eslint-plugin-import')
const js = require('@eslint/js')
const prettier = require('eslint-config-prettier')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')

const MAGIC_NUMBERS = [0, 1, 2]

module.exports = [
  { ignores: ['.homeybuild/'] },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      parser: tsParser,
      parserOptions: { project: './tsconfig.json' },
      sourceType: 'module',
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    plugins: { import: importPlugin },
    rules: {
      ...js.configs.all.rules,
      ...importPlugin.configs.recommended.rules,
      camelcase: 'off',
      'max-lines': 'off',
      'no-magic-numbers': ['error', { ignore: MAGIC_NUMBERS }],
      'no-ternary': 'off',
      'no-underscore-dangle': ['error', { allow: ['__'] }],
      'one-var': 'off',
    },
  },
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
  {
    files: ['**/*.ts'],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.all.rules,
      ...importPlugin.configs.typescript.rules,
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-magic-numbers': [
        'error',
        { ignore: MAGIC_NUMBERS, ignoreEnums: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: 'onHomeyReady' },
      ],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      'import/extensions': 'off',
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
    },
    settings: {
      ...importPlugin.configs.typescript.settings,
      'import/ignore': ['node_modules'],
      'import/resolver': {
        ...importPlugin.configs.typescript.settings['import/resolver'],
        typescript: { alwaysTryTypes: true },
      },
    },
  },
  prettier,
]
