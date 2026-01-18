import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

import { defineConfig } from 'eslint/config'
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x'
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json'
import { Alphabet } from 'eslint-plugin-perfectionist/alphabet'
import { configs as ymlConfigs } from 'eslint-plugin-yml'
import { tailwind4 } from 'tailwind-csstree'
import { configs as tsConfigs } from 'typescript-eslint'

import { classGroups } from './eslint-utils/class-groups.js'

const buildImportGroup = (selector) =>
  ['type', 'default', 'named', 'wildcard', 'require', 'ts-equals'].map(
    (modifier) => `${modifier}-${selector}`,
  )

const arrayLikeSortOptions = {
  groups: ['literal', 'spread'],
}

const typeSortOptions = {
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

const typeLikeSortOptions = {
  groups: [
    'required-index-signature',
    'optional-index-signature',
    'required-property',
    'optional-property',
    'required-method',
    'optional-method',
  ],
}

const config = defineConfig([
  {
    ignores: ['.homeybuild/'],
  },
  {
    extends: [
      js.configs.all,
      unicorn.configs.all,
      tsConfigs.all,
      tsConfigs.strictTypeChecked,
      importXConfigs.errors,
      importXConfigs.typescript,
      prettier,
    ],
    files: ['**/*.{ts,mts,js}'],
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.js'],
        },
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
      '@stylistic/multiline-comment-style': 'error',
      '@stylistic/quotes': [
        'error',
        'single',
        {
          allowTemplateLiterals: 'never',
          avoidEscape: true,
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
          selector: ['property'],
        },
        {
          format: ['camelCase'],
          selector: ['enumMember'],
        },
        {
          filter: {
            match: true,
            regex: String.raw`^[a-z]+(?:_[a-z0-9]+)*(\.(?:[a-z0-9]+_)*([a-z0-9]+)?)?$`,
          },
          format: null,
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        {
          filter: {
            match: true,
            regex: String.raw`^(HM|FP)`,
          },
          format: null,
          selector: ['objectLiteralProperty'],
        },
        {
          format: ['camelCase', 'PascalCase'],
          selector: ['typeProperty'],
        },
        {
          format: ['camelCase', 'PascalCase'],
          selector: ['import'],
        },
        {
          format: ['PascalCase'],
          prefix: ['can', 'did', 'has', 'is', 'should', 'will'],
          selector: ['variable'],
          types: ['boolean'],
        },
        {
          format: ['UPPER_CASE'],
          modifiers: ['const', 'global'],
          selector: ['variable'],
          types: ['boolean', 'number', 'string'],
        },
        {
          format: ['PascalCase'],
          selector: ['enumMember', 'typeLike'],
        },
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: ['parameter'],
        },
        {
          format: ['camelCase'],
          selector: ['default'],
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
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          checkTypePredicates: true,
        },
      ],
      '@typescript-eslint/no-unnecessary-type-assertion': [
        'error',
        {
          checkLiteralConstAssertions: true,
        },
      ],
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_context$',
          enableAutofixRemoval: {
            imports: true,
          },
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
      'import-x/first': 'error',
      'import-x/max-dependencies': [
        'error',
        {
          ignoreTypeImports: true,
        },
      ],
      'import-x/newline-after-import': 'error',
      'import-x/no-absolute-path': 'error',
      'import-x/no-anonymous-default-export': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-default-export': 'error',
      'import-x/no-deprecated': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-dynamic-require': 'error',
      'import-x/no-empty-named-blocks': 'error',
      'import-x/no-extraneous-dependencies': 'error',
      'import-x/no-import-module-exports': 'error',
      'import-x/no-mutable-exports': 'error',
      'import-x/no-named-as-default': 'error',
      'import-x/no-named-as-default-member': 'error',
      'import-x/no-named-default': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-unassigned-import': [
        'error',
        {
          allow: ['source-map-support/register.js'],
        },
      ],
      'import-x/no-unused-modules': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/no-webpack-loader-syntax': 'error',
      'import-x/unambiguous': 'error',
      'max-lines': 'off',
      'no-bitwise': 'off',
      'no-continue': 'off',
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
      'perfectionist/sort-array-includes': ['error', arrayLikeSortOptions],
      'perfectionist/sort-classes': [
        'error',
        {
          ...classGroups,
          newlinesBetween: 1,
          newlinesInside: 1,
        },
      ],
      'perfectionist/sort-decorators': [
        'error',
        {
          customGroups: [
            {
              elementNamePattern: '^fetchDevices$',
              groupName: 'fetch-decorator',
            },
            {
              elementNamePattern: '^syncDevices$',
              groupName: 'sync-decorator',
            },
            {
              elementNamePattern: '^updateDevice(s)?$',
              groupName: 'update-decorator',
            },
          ],
          groups: [
            'sync-decorator',
            'update-decorator',
            'unknown',
            'fetch-decorator',
          ],
        },
      ],
      'perfectionist/sort-enums': [
        'error',
        {
          groups: ['unknown'],
        },
      ],
      'perfectionist/sort-export-attributes': 'error',
      'perfectionist/sort-exports': [
        'error',
        {
          groups: [
            'type-export',
            'named-export',
            'wildcard-export',
            'value-export',
          ],
          newlinesBetween: 1,
        },
      ],
      'perfectionist/sort-heritage-clauses': 'error',
      'perfectionist/sort-import-attributes': 'error',
      'perfectionist/sort-imports': [
        'error',
        {
          groups: [
            ...buildImportGroup('side-effect'),
            ...buildImportGroup('side-effect-style'),
            ...buildImportGroup('style'),
            ...buildImportGroup('builtin'),
            ...buildImportGroup('external'),
            ...buildImportGroup('tsconfig-path'),
            ...buildImportGroup('subpath'),
            ...buildImportGroup('internal'),
            ...buildImportGroup('parent'),
            ...buildImportGroup('sibling'),
            ...buildImportGroup('index'),
          ],
          newlinesBetween: 1,
        },
      ],
      'perfectionist/sort-interfaces': ['error', typeLikeSortOptions],
      'perfectionist/sort-intersection-types': ['error', typeSortOptions],
      'perfectionist/sort-maps': [
        'error',
        {
          groups: ['unknown'],
        },
      ],
      'perfectionist/sort-modules': [
        'error',
        {
          groups: [
            'declare-enum',
            'declare-interface',
            'declare-type',
            'declare-class',
            'declare-function',
            'enum',
            'interface',
            'type',
            'class',
            'function',
            'export-enum',
            'export-interface',
            'export-type',
            'export-class',
            'export-function',
            'export-default-interface',
            'export-default-class',
            'export-default-function',
          ],
          newlinesBetween: 1,
          newlinesInside: 1,
        },
      ],
      'perfectionist/sort-named-exports': [
        'error',
        {
          groups: ['type-export', 'value-export'],
        },
      ],
      'perfectionist/sort-named-imports': [
        'error',
        {
          groups: ['type-import', 'value-import'],
        },
      ],
      'perfectionist/sort-object-types': ['error', typeLikeSortOptions],
      'perfectionist/sort-objects': [
        'error',
        {
          groups: ['property', 'method'],
        },
      ],
      'perfectionist/sort-sets': ['error', arrayLikeSortOptions],
      'perfectionist/sort-switch-case': 'error',
      'perfectionist/sort-union-types': ['error', typeSortOptions],
      'sort-imports': 'off',
      'sort-keys': 'off',
      'unicorn/explicit-length-check': 'off',
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-switch-case': 'off',
      'unicorn/prevent-abbreviations': [
        'error',
        {
          replacements: {
            arg: false,
            args: false,
            param: false,
            params: false,
            utils: false,
          },
        },
      ],
    },
    settings: {
      perfectionist: {
        alphabet: Alphabet.generateRecommendedAlphabet()
          .sortByNaturalSort()
          .placeCharacterBefore({ characterAfter: '-', characterBefore: '/' })
          .getCharacters(),
        ignoreCase: false,
        locales: 'en_US',
        newlinesBetween: 0,
        newlinesInside: 0,
        order: 'asc',
        partitionByComment: true,
        partitionByNewLine: false,
        type: 'custom',
      },
    },
  },
  {
    extends: [tsConfigs.disableTypeChecked],
    files: ['**/*.js'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'import-x/named': 'error',
    },
  },
  {
    files: ['**/api.mts', 'app.mts', 'drivers/*/{device,driver}.mts'],
    rules: {
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': [
        'error',
        {
          target: 'any',
        },
      ],
    },
  },
  {
    files: ['**/*.config.{ts,js}'],
    rules: {
      'import-x/max-dependencies': 'off',
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': [
        'error',
        {
          target: 'any',
        },
      ],
    },
  },
  {
    extends: ['html/flat/all'],
    files: ['**/*.html'],
    language: 'html/html',
    plugins: {
      html,
    },
    rules: {
      '@html-eslint/no-empty-headings': 'off',
      '@html-eslint/require-open-graph-protocol': 'off',
      '@html-eslint/use-baseline': [
        'error',
        {
          available: 'newly',
        },
      ],
    },
  },
  {
    extends: [json.configs.recommended],
    files: ['**/*.json'],
    ignores: [
      '**/package-lock.json',
      '**/package.json',
      'app.json',
      'locales/*.json',
    ],
    language: 'json/json',
    rules: {
      'json/sort-keys': [
        'error',
        'asc',
        {
          caseSensitive: true,
          natural: true,
        },
      ],
    },
  },
  {
    extends: [css.configs.recommended],
    files: ['**/*.css'],
    ignores: ['**/dist.css'],
    language: 'css/css',
    languageOptions: {
      customSyntax: tailwind4,
    },
    rules: {
      'css/no-invalid-properties': [
        'error',
        {
          allowUnknownVariables: true,
        },
      ],
      'css/prefer-logical-properties': 'error',
      'css/relative-font-units': 'error',
      'css/selector-complexity': 'error',
      'css/use-baseline': [
        'error',
        {
          available: 'newly',
        },
      ],
    },
  },
  {
    extends: [markdown.configs.recommended],
    files: ['**/*.md'],
    language: 'markdown/gfm',
    rules: {
      'markdown/no-bare-urls': 'error',
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
    },
  },
  {
    extends: [ymlConfigs.standard, ymlConfigs.prettier],

    /*
     * Rules: {
     *   'yml/file-extension': [
     *     'error',
     *     {
     *       extension: 'yml',
     *     },
     *   ],
     *   'yml/require-string-key': 'error',
     *   'yml/sort-keys': [
     *     'error',
     *     {
     *       order: {
     *         caseSensitive: true,
     *         natural: true,
     *         type: 'asc',
     *       },
     *       pathPattern: '^.*$',
     *     },
     *   ],
     *   'yml/sort-sequence-values': [
     *     'error',
     *     {
     *       order: {
     *         caseSensitive: true,
     *         natural: true,
     *         type: 'asc',
     *       },
     *       pathPattern: '^.*$',
     *     },
     *   ],
     * },
     */
  },
  {
    extends: [packageJsonConfigs.recommended, packageJsonConfigs.stylistic],
    files: ['package.json'],
    rules: {
      'package-json/restrict-dependency-ranges': [
        'error',
        [
          {
            rangeType: 'caret',
          },
        ],
      ],
    },
  },
])

export default config
