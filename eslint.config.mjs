import eslint from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import packageJson from 'eslint-plugin-package-json/configs/recommended'
import perfectionist from 'eslint-plugin-perfectionist'
import tsEslint from 'typescript-eslint'

const groups = {
  groups: [
    'keyword',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'operator',
    'conditional',
    'import',
    'nullish',
    'unknown',
  ],
}

const optionalFirst = {
  groupKind: 'optional-first',
}

const typesFirst = {
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
        perfectionist,
      },
      rules: {
        '@stylistic/line-comment-position': 'error',
        '@stylistic/lines-around-comment': 'error',
        '@stylistic/lines-between-class-members': ['error', 'always'],
        '@stylistic/multiline-comment-style': 'error',
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
        'perfectionist/sort-array-includes': 'error',
        'perfectionist/sort-classes': [
          'error',
          {
            customGroups: {
              onInit: 'onInit',
            },
            groups: [
              // Signatures
              'static-index-signature',
              'index-signature',
              'readonly-index-signature',
              // Properties
              'decorated-static-property',
              'decorated-static-readonly-property',
              'decorated-static-protected-property',
              'decorated-static-protected-readonly-property',
              'decorated-static-private-property',
              'decorated-static-private-readonly-property',
              'static-property',
              'static-readonly-property',
              'static-protected-property',
              'static-protected-readonly-property',
              'static-private-property',
              'static-private-readonly-property',
              'decorated-property',
              'decorated-readonly-property',
              'decorated-protected-property',
              'decorated-protected-readonly-property',
              'decorated-private-property',
              'decorated-private-readonly-property',
              'property',
              'readonly-property',
              'protected-property',
              'protected-readonly-property',
              'private-property',
              'private-readonly-property',
              'abstract-property',
              'abstract-readonly-property',
              'abstract-protected-property',
              'abstract-protected-readonly-property',
              // Static blocks
              'static-block',
              // Constructors
              'constructor',
              'protected-constructor',
              'private-constructor',
              // Iniliazers
              'onInit',
              // Accessors
              'decorated-static-accessor-property',
              'decorated-static-protected-accessor-property',
              'decorated-static-private-accessor-property',
              'static-accessor-property',
              'static-protected-accessor-property',
              'static-private-accessor-property',
              'decorated-accessor-property',
              'decorated-protected-accessor-property',
              'decorated-private-accessor-property',
              'accessor-property',
              'protected-accessor-property',
              'private-accessor-property',
              'abstract-accessor-property',
              'abstract-protected-accessor-property',
              // Getters and setters
              ['decorated-static-get-method', 'decorated-static-set-method'],
              [
                'decorated-static-protected-get-method',
                'decorated-static-protected-set-method',
              ],
              [
                'decorated-static-private-get-method',
                'decorated-static-private-set-method',
              ],
              ['static-get-method', 'static-set-method'],
              ['static-protected-get-method', 'static-protected-set-method'],
              ['static-private-get-method', 'static-private-set-method'],
              ['decorated-get-method', 'decorated-set-method'],
              [
                'decorated-protected-get-method',
                'decorated-protected-set-method',
              ],
              ['decorated-private-get-method', 'decorated-private-set-method'],
              ['get-method', 'set-method'],
              ['protected-get-method', 'protected-set-method'],
              ['private-get-method', 'private-set-method'],
              ['abstract-get-method', 'abstract-set-method'],
              [
                'abstract-protected-get-method',
                'abstract-protected-set-method',
              ],
              // Methods
              'decorated-static-method',
              'decorated-static-protected-method',
              'decorated-static-private-method',
              'static-method',
              'static-protected-method',
              'static-private-method',
              'decorated-method',
              'decorated-protected-method',
              'decorated-private-method',
              'method',
              'protected-method',
              'private-method',
              'abstract-method',
              'abstract-protected-method',
            ],
          },
        ],
        'perfectionist/sort-enums': 'error',
        'perfectionist/sort-exports': 'error',
        'perfectionist/sort-imports': 'error',
        'perfectionist/sort-interfaces': ['error', optionalFirst],
        'perfectionist/sort-intersection-types': ['error', groups],
        'perfectionist/sort-maps': 'error',
        'perfectionist/sort-named-exports': ['error', typesFirst],
        'perfectionist/sort-named-imports': ['error', typesFirst],
        'perfectionist/sort-object-types': ['error', optionalFirst],
        'perfectionist/sort-objects': 'error',
        'perfectionist/sort-switch-case': 'error',
        'perfectionist/sort-union-types': ['error', groups],
        'sort-imports': 'off',
        'sort-keys': 'off',
      },
    },
    {
      files: ['**/*.mjs'],
      ...tsEslint.configs.disableTypeChecked,
    },
    {
      settings: {
        perfectionist: {
          ignoreCase: false,
          order: 'asc',
          partitionByComment: true,
          type: 'natural',
        },
      },
    },
  ),
  packageJson,
]
