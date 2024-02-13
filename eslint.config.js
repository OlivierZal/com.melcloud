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
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            // Index signature
            'signature',
            'readonly-signature',

            // Fields
            'public-static-field',
            'public-static-readonly-field',
            'protected-static-field',
            'protected-static-readonly-field',
            'private-static-field',
            'private-static-readonly-field',
            '#private-static-field',
            '#private-static-readonly-field',

            'public-decorated-field',
            'public-decorated-readonly-field',
            'protected-decorated-field',
            'protected-decorated-readonly-field',
            'private-decorated-field',
            'private-decorated-readonly-field',

            'public-instance-field',
            'public-instance-readonly-field',
            'protected-instance-field',
            'protected-instance-readonly-field',
            'private-instance-field',
            'private-instance-readonly-field',
            '#private-instance-field',
            '#private-instance-readonly-field',

            'public-abstract-field',
            'public-abstract-readonly-field',
            'protected-abstract-field',
            'protected-abstract-readonly-field',

            'public-field',
            'public-readonly-field',
            'protected-field',
            'protected-readonly-field',
            'private-field',
            'private-readonly-field',
            '#private-field',
            '#private-readonly-field',

            'static-field',
            'static-readonly-field',
            'instance-field',
            'instance-readonly-field',
            'abstract-field',
            'abstract-readonly-field',

            'decorated-field',
            'decorated-readonly-field',

            'field',
            'readonly-field',

            // Static initialization
            'static-initialization',

            // Constructors
            'public-constructor',
            'protected-constructor',
            'private-constructor',

            // Getters
            'public-static-get',
            'protected-static-get',
            'private-static-get',
            '#private-static-get',

            'public-decorated-get',
            'protected-decorated-get',
            'private-decorated-get',

            'public-instance-get',
            'protected-instance-get',
            'private-instance-get',
            '#private-instance-get',

            'public-abstract-get',
            'protected-abstract-get',

            'public-get',
            'protected-get',
            'private-get',
            '#private-get',

            'static-get',
            'instance-get',
            'abstract-get',

            'decorated-get',

            'get',

            // Setters
            'public-static-set',
            'protected-static-set',
            'private-static-set',
            '#private-static-set',

            'public-decorated-set',
            'protected-decorated-set',
            'private-decorated-set',

            'public-instance-set',
            'protected-instance-set',
            'private-instance-set',
            '#private-instance-set',

            'public-abstract-set',
            'protected-abstract-set',

            'public-set',
            'protected-set',
            'private-set',

            'static-set',
            'instance-set',
            'abstract-set',

            'decorated-set',

            'set',

            // Methods
            'public-static-method',
            'protected-static-method',
            'private-static-method',
            '#private-static-method',
            'public-decorated-method',
            'protected-decorated-method',
            'private-decorated-method',
            'public-instance-method',
            'protected-instance-method',
            'private-instance-method',
            '#private-instance-method',
            'public-abstract-method',
            'protected-abstract-method',
          ],
        },
      ],
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
