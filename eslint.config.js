const globals = require('globals')
const importPlugin = require('eslint-plugin-import')
const js = require('@eslint/js')
const parser = require('@typescript-eslint/parser')
const prettier = require('eslint-config-prettier')
const stylistic = require('@stylistic/eslint-plugin')
const tsPlugin = require('@typescript-eslint/eslint-plugin')

const [jsOverrides] = tsPlugin.configs['eslint-recommended'].overrides

module.exports = [
  { ignores: ['.homeybuild/'] },
  {
    languageOptions: {
      ecmaVersion: 'latest',
      parser,
      parserOptions: { project: './tsconfig.json' },
      sourceType: 'module',
    },
    linterOptions: { reportUnusedDisableDirectives: true },
    plugins: {
      '@stylistic': stylistic,
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      ...js.configs.all.rules,
      ...importPlugin.configs.recommended.rules,
      camelcase: 'off',
      'max-lines': 'off',
      'no-ternary': 'off',
      'no-underscore-dangle': ['error', { allow: ['__'] }],
      'one-var': 'off',
    },
  },
  { files: ['**/*.js'], languageOptions: { globals: globals.node } },
  {
    files: ['**/*.ts'],
    rules: {
      ...jsOverrides.rules,
      ...tsPlugin.configs.all.rules,
      ...importPlugin.configs.typescript.rules,
      '@typescript-eslint/naming-convention': 'off',
      '@typescript-eslint/no-magic-numbers': ['error', { ignoreEnums: true }],
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
  { rules: { '@stylistic/lines-between-class-members': ['error', 'always'] } },
  prettier,
]
