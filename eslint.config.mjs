import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import packageJson from 'eslint-plugin-package-json/configs/recommended'
import perfectionist from 'eslint-plugin-perfectionist'
import tsEslint from 'typescript-eslint'

const sortTypeOptions = {
  groups: [
    'conditional',
    'function',
    'import',
    'intersection',
    'keyword',
    'literal',
    'named',
    'object',
    'operator',
    'tuple',
    'union',
    'nullish',
    'unknown',
  ],
}

const sortNamedExportImportOptions = {
  groupKind: 'types-first',
}

export default [
  ...tsEslint.config(
    {
      ignores: ['.homeybuild/'],
    },
    {
      extends: [
        eslint.configs.all,
        ...tsEslint.configs.all,
        ...tsEslint.configs.strictTypeChecked,
        perfectionist.configs['recommended-natural'],
        prettier,
      ],
      files: ['**/*.ts', '**/*.mjs'],
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.mjs'],
            defaultProject: './tsconfig.json',
          },
          tsconfigRootDir: import.meta.dirname,
        },
      },
      linterOptions: {
        reportUnusedDisableDirectives: true,
      },
      plugins: {
        '@stylistic': stylistic,
      },
      rules: {
        '@stylistic/line-comment-position': 'error',
        '@stylistic/lines-around-comment': 'error',
        '@stylistic/lines-between-class-members': ['error', 'always'],
        '@stylistic/padding-line-between-statements': 'error',
        '@stylistic/quotes': [
          'error',
          'single',
          {
            allowTemplateLiterals: false,
            avoidEscape: true,
            ignoreStringLiterals: false,
          },
        ],
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
        '@typescript-eslint/consistent-return': 'off',
        '@typescript-eslint/member-ordering': 'off',
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
        '@typescript-eslint/no-dupe-class-members': 'off',
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
        '@typescript-eslint/no-redeclare': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            caughtErrorsIgnorePattern: '^_',
            varsIgnorePattern: 'onHomeyReady',
          },
        ],
        '@typescript-eslint/prefer-readonly-parameter-types': 'off',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/typedef': 'off',
        camelcase: 'off',
        'max-lines': 'off',
        'no-bitwise': 'off',
        'no-empty': [
          'error',
          {
            allowEmptyCatch: true,
          },
        ],
        'no-ternary': 'off',
        'no-undefined': 'off',
        'no-underscore-dangle': [
          'error',
          {
            allow: ['__'],
          },
        ],
        'one-var': ['error', 'never'],
        'perfectionist/sort-classes': [
          'error',
          {
            customGroups: {
              eventHandler: 'on*',
            },
            groups: [
              // Signatures
              'static-index-signature',
              'readonly-index-signature',
              'index-signature',
              // Properties
              'decorated-static-public-property',
              'decorated-static-public-readonly-property',
              'decorated-static-protected-property',
              'decorated-static-protected-readonly-property',
              'decorated-static-private-property',
              'decorated-static-private-readonly-property',
              'decorated-static-property',
              'decorated-static-readonly-property',
              'static-public-property',
              'static-public-readonly-property',
              'static-protected-property',
              'static-protected-readonly-property',
              'static-private-property',
              'static-private-readonly-property',
              'static-property',
              'static-readonly-property',
              'decorated-public-property',
              'decorated-public-readonly-property',
              'decorated-protected-property',
              'decorated-protected-readonly-property',
              'decorated-private-property',
              'decorated-private-readonly-property',
              'decorated-property',
              'decorated-readonly-property',
              'public-property',
              'public-readonly-property',
              'protected-property',
              'protected-readonly-property',
              'private-property',
              'private-readonly-property',
              'property',
              'readonly-property',
              'abstract-public-property',
              'abstract-public-readonly-property',
              'abstract-protected-property',
              'abstract-protected-readonly-property',
              'abstract-property',
              'abstract-readonly-property',
              // Static blocks
              'static-block',
              // Constructors
              'public-constructor',
              'protected-constructor',
              'private-constructor',
              'constructor',
              // Event handlers
              'eventHandler',
              // Accessors
              'decorated-static-public-accessor-property',
              'decorated-static-protected-accessor-property',
              'decorated-static-private-accessor-property',
              'decorated-static-accessor-property',
              'static-public-accessor-property',
              'static-protected-accessor-property',
              'static-private-accessor-property',
              'static-accessor-property',
              'decorated-public-accessor-property',
              'decorated-protected-accessor-property',
              'decorated-private-accessor-property',
              'decorated-accessor-property',
              'public-accessor-property',
              'protected-accessor-property',
              'private-accessor-property',
              'accessor',
              'abstract-public-accessor-property',
              'abstract-protected-accessor-property',
              'abstract-accessor-property',
              // Getters and setters
              [
                'decorated-static-public-get-method',
                'decorated-static-public-set-method',
              ],
              [
                'decorated-static-protected-get-method',
                'decorated-static-protected-set-method',
              ],
              [
                'decorated-static-private-get-method',
                'decorated-static-private-set-method',
              ],
              ['decorated-static-get-method', 'decorated-static-set-method'],
              ['static-public-get-method', 'static-public-set-method'],
              ['static-protected-get-method', 'static-protected-set-method'],
              ['static-private-get-method', 'static-private-set-method'],
              ['static-get-method', 'static-set-method'],
              ['decorated-public-get-method', 'decorated-public-set-method'],
              [
                'decorated-protected-get-method',
                'decorated-protected-set-method',
              ],
              ['decorated-private-get-method', 'decorated-private-set-method'],
              ['decorated-get-method', 'decorated-set-method'],
              ['public-get-method', 'public-set-method'],
              ['protected-get-method', 'protected-set-method'],
              ['private-get-method', 'private-set-method'],
              ['get', 'set'],
              ['abstract-public-get-method', 'abstract-public-set-method'],
              [
                'abstract-protected-get-method',
                'abstract-protected-set-method',
              ],
              ['abstract-get-method', 'abstract-set-method'],
              // Methods
              'decorated-static-public-method',
              'decorated-static-protected-method',
              'decorated-static-private-method',
              'decorated-static-method',
              'static-public-method',
              'static-protected-method',
              'static-private-method',
              'static-method',
              'decorated-public-method',
              'decorated-protected-method',
              'decorated-private-method',
              'decorated-method',
              'public-method',
              'protected-method',
              'private-method',
              'method',
              'abstract-public-method',
              'abstract-protected-method',
              'abstract-method',
            ],
          },
        ],
        'perfectionist/sort-interfaces': 'off',
        'perfectionist/sort-intersection-types': ['error', sortTypeOptions],
        'perfectionist/sort-named-exports': [
          'error',
          sortNamedExportImportOptions,
        ],
        'perfectionist/sort-named-imports': [
          'error',
          sortNamedExportImportOptions,
        ],
        'perfectionist/sort-object-types': 'off',
        'perfectionist/sort-union-types': ['error', sortTypeOptions],
        'sort-imports': 'off',
        'sort-keys': [
          'error',
          'asc',
          {
            natural: true,
          },
        ],
      },
    },
    {
      files: ['**/*.mjs'],
      ...tsEslint.configs.disableTypeChecked,
    },
    {
      settings: {
        ignoreCase: false,
        partitionByComment: true,
      },
    },
  ),
  packageJson,
]
