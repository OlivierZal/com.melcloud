const eslint = require('@eslint/js')
const globals = require('globals')
const importPlugin = require('eslint-plugin-import')
const prettier = require('eslint-config-prettier')
const stylistic = require('@stylistic/eslint-plugin')
const tsEslint = require('typescript-eslint')

module.exports = tsEslint.config(
  { ignores: ['dist/'] },
  eslint.configs.all,
  ...tsEslint.configs.all,
  {
    languageOptions: { parserOptions: { project: true } },
    linterOptions: { reportUnusedDisableDirectives: true },
    plugins: { '@stylistic': stylistic, import: importPlugin },
  },
  {
    rules: {
      // ...importPlugin.configs.recommended.rules,
      '@stylistic/lines-between-class-members': 'error',
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: {
            memberTypes: [
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

              // Getters and setters
              ['public-static-get', 'public-static-set'],
              ['protected-static-get', 'protected-static-set'],
              ['private-static-get', 'private-static-set'],
              ['#private-static-get', '#private-static-set'],

              ['public-decorated-get', 'public-decorated-set'],
              ['protected-decorated-get', 'protected-decorated-set'],
              ['private-decorated-get', 'private-decorated-set'],

              ['public-instance-get', 'public-instance-set'],
              ['protected-instance-get', 'protected-instance-set'],
              ['private-instance-get', 'private-instance-set'],
              ['#private-instance-get', '#private-instance-set'],

              ['public-abstract-get', 'public-abstract-set'],
              ['protected-abstract-get', 'protected-abstract-set'],

              ['public-get', 'public-set'],
              ['protected-get', 'protected-set'],
              ['private-get', 'private-set'],
              ['#private-get', '#private-set'],

              ['static-get', 'static-set'],
              ['instance-get', 'instance-set'],
              ['abstract-get', 'abstract-set'],

              ['decorated-get', 'decorated-set'],

              ['get', 'set'],

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
            optionalityOrder: 'optional-first',
            order: 'natural',
          },
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          filter: {
            match: true,
            regex: '^(Ata|Atw|Erv)$',
          },
          format: null,
          selector: 'enumMember',
        },
        {
          format: ['snake_case'],
          selector: 'enumMember',
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
          selector: 'default',
        },
      ],
      '@typescript-eslint/no-explicit-any': ['error', { ignoreRestArgs: true }],
      '@typescript-eslint/no-magic-numbers': ['error', { ignoreEnums: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: 'onHomeyReady' },
      ],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      camelcase: 'off',
      'no-ternary': 'off',
      'no-underscore-dangle': ['error', { allow: ['__'] }],
      'one-var': 'off',
      'sort-keys': ['error', 'asc', { natural: true }],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      ...importPlugin.configs.typescript.rules,
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
    },
    settings: {
      ...importPlugin.configs.typescript.settings,
      'import/resolver': {
        ...importPlugin.configs.typescript.settings['import/resolver'],
        typescript: { alwaysTryTypes: true },
      },
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { sourceType: 'script' },
    },
    rules: {
      ...tsEslint.configs.disableTypeChecked.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-var-requires': 'off',
    },
  },
  prettier,
)
