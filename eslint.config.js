import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import packageJson from 'eslint-plugin-package-json/configs/recommended'
import perfectionist from 'eslint-plugin-perfectionist'
import yml from 'eslint-plugin-yml'
import ts, { configs as tsConfigs } from 'typescript-eslint'

import { classGroups } from './eslint-utils/class-groups.js'

const arrayLikeGroups = {
  groups: ['literal', 'spread'],
}

const decoratorGroups = {
  groups: ['unknown'],
}

const importGroups = {
  groups: [
    'side-effect',
    'side-effect-style',
    'builtin',
    'external',
    'internal',
    'parent',
    'sibling',
    'index',
    'object',
    'style',
    'unknown',
    'builtin-type',
    'external-type',
    'internal-type',
    'parent-type',
    'sibling-type',
    'index-type',
    'type',
  ],
}

const moduleGroups = {
  groups: [
    'declare-enum',
    'enum',
    'export-enum',
    'declare-interface',
    'interface',
    'export-interface',
    'declare-type',
    'type',
    'export-type',
    'declare-class',
    'class',
    'export-class',
    'declare-function',
    'function',
    'export-function',
    [
      'export-default-interface',
      'export-default-class',
      'export-default-function',
    ],
  ],
}

const objectGroups = {
  groups: ['property', 'method'],
}

const typeGroups = {
  groups: [
    'import',
    'keyword',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'conditional',
    'operator',
    'unknown',
    'nullish',
  ],
}

const typeLikeGroups = {
  groups: [
    'required-index-signature',
    'optional-index-signature',
    'required-property',
    'optional-property',
    'required-method',
    'optional-method',
  ],
}

const valuesFirst = {
  groupKind: 'values-first',
}

const config = [
  {
    ignores: ['.homeybuild/'],
  },
  ...ts.config(
    {
      extends: [
        js.configs.all,
        tsConfigs.all,
        tsConfigs.strictTypeChecked,
        importPlugin.flatConfigs.errors,
        importPlugin.flatConfigs.typescript,
        prettier,
      ],
      files: ['**/*.{ts,mts,js}'],
      languageOptions: {
        ecmaVersion: 'latest',
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.js'],
          },
          tsconfigRootDir: import.meta.dirname,
          warnOnUnsupportedTypeScriptVersion: false,
        },
        sourceType: 'module',
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
            },
          },
        ],
        '@typescript-eslint/consistent-return': 'off',
        '@typescript-eslint/consistent-type-assertions': [
          'error',
          {
            arrayLiteralTypeAssertions: 'never',
            assertionStyle: 'as',
            objectLiteralTypeAssertions: 'never',
          },
        ],
        '@typescript-eslint/member-ordering': 'off',
        '@typescript-eslint/naming-convention': [
          'error',
          {
            filter: {
              match: true,
              regex: '^EnergyReport(Regular|Total)$',
            },
            format: null,
            selector: 'property',
          },
          {
            filter: {
              match: true,
              regex: '^[a-z]+(?:_[a-z0-9]+)*(\\.(?:[a-z0-9]+_)*([a-z0-9]+)?)?$',
            },
            format: null,
            selector: ['objectLiteralProperty', 'typeProperty'],
          },
          {
            format: ['camelCase', 'PascalCase'],
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
            format: ['UPPER_CASE'],
            modifiers: ['const', 'global'],
            selector: 'variable',
            types: ['boolean', 'number', 'string'],
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
        '@typescript-eslint/no-redeclare': 'off',
        '@typescript-eslint/no-unnecessary-condition': [
          'error',
          {
            checkTypePredicates: true,
          },
        ],
        '@typescript-eslint/no-unsafe-type-assertion': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_context$',
            varsIgnorePattern: '^onHomeyReady$',
          },
        ],
        '@typescript-eslint/prefer-destructuring': [
          'error',
          {
            array: true,
            object: true,
          },
          {
            enforceForDeclarationWithTypeAnnotation: true,
            enforceForRenamedProperties: true,
          },
        ],
        '@typescript-eslint/prefer-readonly-parameter-types': 'off',
        '@typescript-eslint/return-await': ['error', 'in-try-catch'],
        '@typescript-eslint/typedef': 'off',
        camelcase: 'off',
        curly: 'error',
        'import/first': 'error',
        'import/max-dependencies': [
          'error',
          {
            ignoreTypeImports: true,
          },
        ],
        'import/newline-after-import': 'error',
        'import/no-absolute-path': 'error',
        'import/no-anonymous-default-export': 'error',
        'import/no-cycle': 'error',
        'import/no-default-export': 'error',
        'import/no-deprecated': 'error',
        'import/no-duplicates': 'error',
        'import/no-dynamic-require': 'error',
        'import/no-empty-named-blocks': 'error',
        'import/no-extraneous-dependencies': 'error',
        'import/no-import-module-exports': 'error',
        'import/no-mutable-exports': 'error',
        'import/no-named-as-default': 'error',
        'import/no-named-as-default-member': 'error',
        'import/no-named-default': 'error',
        'import/no-namespace': 'error',
        'import/no-relative-packages': 'error',
        'import/no-self-import': 'error',
        'import/no-unassigned-import': [
          'error',
          {
            allow: ['source-map-support/register.js', 'core-js/actual/**'],
          },
        ],
        'import/no-unused-modules': 'error',
        'import/no-useless-path-segments': 'error',
        'import/no-webpack-loader-syntax': 'error',
        'import/unambiguous': 'error',
        'max-lines': 'off',
        'no-bitwise': 'off',
        'no-else-return': [
          'error',
          {
            allowElseIf: false,
          },
        ],
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
        'perfectionist/sort-array-includes': ['error', arrayLikeGroups],
        'perfectionist/sort-classes': ['error', classGroups],
        'perfectionist/sort-decorators': ['error', decoratorGroups],
        'perfectionist/sort-enums': 'error',
        'perfectionist/sort-exports': ['error', valuesFirst],
        'perfectionist/sort-heritage-clauses': 'error',
        'perfectionist/sort-imports': ['error', importGroups],
        'perfectionist/sort-interfaces': ['error', typeLikeGroups],
        'perfectionist/sort-intersection-types': ['error', typeGroups],
        'perfectionist/sort-maps': 'error',
        'perfectionist/sort-modules': ['error', moduleGroups],
        'perfectionist/sort-named-exports': ['error', valuesFirst],
        'perfectionist/sort-named-imports': ['error', valuesFirst],
        'perfectionist/sort-object-types': ['error', typeLikeGroups],
        'perfectionist/sort-objects': ['error', objectGroups],
        'perfectionist/sort-sets': ['error', arrayLikeGroups],
        'perfectionist/sort-switch-case': 'error',
        'perfectionist/sort-union-types': ['error', typeGroups],
        'sort-imports': 'off',
        'sort-keys': 'off',
      },
      settings: {
        perfectionist: {
          ignoreCase: false,
          locales: 'en_US',
          order: 'asc',
          partitionByComment: true,
          type: 'natural',
        },
        ...importPlugin.flatConfigs.typescript.settings,
        'import/resolver': {
          ...importPlugin.flatConfigs.typescript.settings['import/resolver'],
          '@helljs/eslint-import-resolver-x': {
            alwaysTryTypes: true,
          },
        },
      },
    },
    {
      extends: [tsConfigs.disableTypeChecked],
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
      },
    },
    {
      files: [
        '**/*.config.{ts,js}',
        '**/api.mts',
        'app.mts',
        'drivers/*/{device,driver}.mts',
      ],
      rules: {
        'import/no-default-export': 'off',
        'import/prefer-default-export': [
          'error',
          {
            target: 'any',
          },
        ],
      },
    },
  ),
  {
    files: ['**/*.html'],
    ...html.configs['flat/recommended'],
    rules: {
      ...html.configs['flat/recommended'].rules,
      '@html-eslint/id-naming-convention': 'error',
      '@html-eslint/lowercase': 'error',
      '@html-eslint/no-abstract-roles': 'error',
      '@html-eslint/no-accesskey-attrs': 'error',
      '@html-eslint/no-aria-hidden-body': 'error',
      '@html-eslint/no-extra-spacing-text': 'error',
      '@html-eslint/no-heading-inside-button': 'error',
      '@html-eslint/no-inline-styles': 'error',
      '@html-eslint/no-invalid-role': 'error',
      '@html-eslint/no-multiple-empty-lines': 'error',
      '@html-eslint/no-nested-interactive': 'error',
      '@html-eslint/no-non-scalable-viewport': 'error',
      '@html-eslint/no-positive-tabindex': 'error',
      '@html-eslint/no-script-style-type': 'error',
      '@html-eslint/no-skip-heading-levels': 'error',
      '@html-eslint/no-target-blank': 'error',
      '@html-eslint/no-trailing-spaces': 'error',
      '@html-eslint/prefer-https': 'error',
      '@html-eslint/require-button-type': 'error',
      '@html-eslint/require-explicit-size': 'error',
      '@html-eslint/require-form-method': 'error',
      '@html-eslint/require-frame-title': 'error',
      '@html-eslint/require-input-label': 'error',
      '@html-eslint/require-meta-charset': 'error',
      '@html-eslint/require-meta-description': 'error',
      '@html-eslint/require-meta-viewport': 'error',
      '@html-eslint/sort-attrs': 'error',
    },
  },
  {
    files: ['**/*.json'],
    ignores: [
      '**/package-lock.json',
      '**/package.json',
      'app.json',
      'locales/*.json',
    ],
    language: 'json/json',
    ...json.configs.recommended,
    rules: {
      ...json.configs.recommended.rules,
      'json/sort-keys': [
        'error',
        'asc',
        {
          natural: true,
        },
      ],
    },
  },
  {
    files: ['**/*.css'],
    ignores: ['**/dist.css'],
    language: 'css/css',
    ...css.configs.recommended,
  },
  {
    files: ['**/*.md'],
    language: 'markdown/gfm',
    plugins: {
      markdown,
    },
    rules: {
      ...markdown.configs.recommended.rules,
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
    },
  },
  ...yml.configs['flat/standard'],
  ...yml.configs['flat/prettier'],
  {
    rules: {
      'yml/block-mapping-colon-indicator-newline': 'error',
      'yml/file-extension': [
        'error',
        {
          extension: 'yml',
        },
      ],
      'yml/no-multiple-empty-lines': 'error',
      'yml/no-trailing-zeros': 'error',
      'yml/require-string-key': 'error',
    },
  },
  packageJson,
]

export default config
