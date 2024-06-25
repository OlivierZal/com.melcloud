import eslint from '@eslint/js'
// @ts-expect-error: untyped module
import importPlugin from 'eslint-plugin-import'
import prettier from 'eslint-config-prettier'
import stylistic from '@stylistic/eslint-plugin'
import tsEslint from 'typescript-eslint'

export default tsEslint.config(
  {
    ignores: ['.homeybuild/'],
  },
  {
    extends: [
      eslint.configs.all,
      ...tsEslint.configs.all,
      importPlugin.configs.typescript,
      prettier,
    ],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.json',
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      // @ts-expect-error: incorrect type
      '@stylistic': stylistic,
      import: importPlugin,
    },
    rules: {
      // ...importPlugin.configs.recommended.rules,
      '@stylistic/lines-between-class-members': ['error', 'always'],
      '@stylistic/spaced-comment': [
        'error',
        'always',
        {
          block: {
            balanced: true,
            exceptions: ['*'],
            markers: ['!'],
          },
          line: {
            exceptions: ['/', '#'],
            markers: ['/'],
          },
        },
      ],
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: 'onHomeyReady',
        },
      ],
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      camelcase: 'off',
      'import/no-duplicates': [
        'error',
        {
          'prefer-inline': true,
        },
      ],
      'max-lines': 'off',
      'no-bitwise': 'off',
      'no-empty': [
        'error',
        {
          allowEmptyCatch: true,
        },
      ],
      'no-ternary': 'off',
      'no-underscore-dangle': [
        'error',
        {
          allow: ['__'],
        },
      ],
      'one-var': ['error', 'never'],
      'sort-keys': [
        'error',
        'asc',
        {
          natural: true,
        },
      ],
    },
    settings: {
      'import/resolver': {
        ...importPlugin.configs.typescript.settings['import/resolver'],
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
  },
  {
    ...tsEslint.configs.disableTypeChecked,
    files: ['**/*.mjs'],
    languageOptions: {
      parserOptions: {
        project: 'tsconfig.checkjs.json',
      },
    },
  },
)
