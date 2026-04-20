import { defineConfig } from 'eslint/config'
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x'
import { jsdoc } from 'eslint-plugin-jsdoc'
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json'
import { Alphabet } from 'eslint-plugin-perfectionist/alphabet'
import { configs as ymlConfigs } from 'eslint-plugin-yml'
import { tailwind4 } from 'tailwind-csstree'
import { configs as tsConfigs } from 'typescript-eslint'
import css from '@eslint/css'
import js from '@eslint/js'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

const buildImportGroup = (selector: string): string[] =>
  ['type', 'named', 'default', 'wildcard', 'require', 'ts-equals'].map(
    (modifier) => `${modifier}-${selector}`,
  )

const arrayLikeSortOptions = {
  groups: ['literal'],
}

const typeSortOptions = {
  groups: [
    'keyword',
    'import',
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
    ignores: ['.homeybuild/', 'coverage/'],
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
          allowDefaultProject: ['*.js', '*.config.ts', 'eslint-utils/*.ts'],
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
      '@stylistic/multiline-comment-style': ['error', 'separate-lines'],
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
      '@typescript-eslint/consistent-type-exports': [
        'error',
        {
          fixMixedExportsWithInlineTypeSpecifier: true,
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/naming-convention': [
        'error',
        // ── Catch-all ────────────────────────────────────────
        {
          format: ['camelCase'],
          leadingUnderscore: 'forbid',
          selector: 'default',
          trailingUnderscore: 'forbid',
        },
        // ── Variables ────────────────────────────────────────
        // PascalCase: `as const` enum-like objects.
        // UPPER_CASE: scalar constants.
        {
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          selector: 'variable',
        },
        // Destructured — we don't control external shapes (API responses, libs).
        {
          format: null,
          modifiers: ['destructured'],
          selector: 'variable',
        },
        // ── Booleans (variables, parameters, class properties) ──
        // Semantic prefixes make intent obvious at the call site.
        {
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should'],
          selector: ['variable', 'parameter', 'classProperty'],
          types: ['boolean'],
        },
        // ── Parameters ───────────────────────────────────────
        // Leading underscore for intentionally unused params.
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: 'parameter',
        },
        // Destructured parameters — we don't control external shapes (API types).
        {
          format: null,
          modifiers: ['destructured'],
          selector: 'parameter',
        },
        // Destructured boolean parameters from external types.
        {
          format: null,
          modifiers: ['destructured'],
          selector: 'parameter',
          types: ['boolean'],
        },
        // ── Functions & methods ──────────────────────────────
        {
          format: ['camelCase'],
          selector: [
            'function',
            'classMethod',
            'objectLiteralMethod',
            'typeMethod',
          ],
        },
        // ── Homey-specific ──────────────────────────────────
        // Capability handlers use snake_case.
        {
          format: null,
          modifiers: ['requiresQuotes'],
          selector: 'objectLiteralMethod',
        },
        {
          filter: { match: true, regex: '_' },
          format: null,
          selector: 'objectLiteralMethod',
        },
        // Translation function __ (double underscore)
        {
          filter: { match: true, regex: '^__$' },
          format: null,
          selector: 'objectLiteralProperty',
        },
        // ── Properties ───────────────────────────────────────
        // Permissive: DTOs, API contracts, and serialization use mixed conventions.
        {
          format: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        // Quoted keys ('Content-Type', 'x-api-key', '@scope/pkg') — skip entirely.
        {
          format: null,
          modifiers: ['requiresQuotes'],
          selector: ['objectLiteralProperty', 'typeProperty'],
        },
        {
          format: ['camelCase'],
          leadingUnderscore: 'allow',
          selector: 'classProperty',
        },
        // ── Imports ──────────────────────────────────────────
        {
          format: ['camelCase', 'PascalCase'],
          selector: 'import',
        },
        // ── Types, interfaces, classes, enums ────────────────
        {
          format: ['PascalCase'],
          selector: 'typeLike',
        },
        // ── Type parameters (generics) ───────────────────────
        // T-prefix: T, TKey, TValue, TResult — universal TS convention.
        {
          format: ['PascalCase'],
          prefix: ['T'],
          selector: 'typeParameter',
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
          ignore: [-1, 0, 1, 2],
          ignoreEnums: true,
          ignoreNumericLiteralTypes: true,
          ignoreReadonlyClassProperties: true,
          ignoreTypeIndexes: true,
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
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          enableAutofixRemoval: {
            imports: true,
          },
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
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          allowDefaultCaseForExhaustiveSwitch: false,
          requireDefaultForNonUnion: true,
        },
      ],
      '@typescript-eslint/typedef': 'off',
      camelcase: 'off',
      'capitalized-comments': 'off',
      curly: 'error',
      'default-case': 'off',
      'import-x/first': 'error',
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
      'import-x/no-unassigned-import': 'error',
      'import-x/no-unused-modules': [
        'error',
        {
          missingExports: true,
          suppressMissingFileEnumeratorAPIWarning: true,
          unusedExports: true,
        },
      ],
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
          customGroups: [
            {
              elementNamePattern: '^onInit$',
              groupName: 'homey-lifecycle-init',
              selector: 'method',
            },
            {
              elementNamePattern: '^onPair$',
              groupName: 'homey-lifecycle-pair',
              selector: 'method',
            },
            {
              elementNamePattern: '^onRepair$',
              groupName: 'homey-lifecycle-repair',
              selector: 'method',
            },
            {
              elementNamePattern: '^onSettings$',
              groupName: 'homey-lifecycle-settings',
              selector: 'method',
            },
            {
              elementNamePattern: '^onDeleted$',
              groupName: 'homey-lifecycle-deleted',
              selector: 'method',
            },
            {
              elementNamePattern: '^onUninit$',
              groupName: 'homey-lifecycle-uninit',
              selector: 'method',
            },
          ],
          groups: [
            // ── Signatures ────────────────────────────────────────
            'index-signature',
            // ── Static fields ─────────────────────────────────────
            'static-decorated-property',
            'static-property',
            'static-accessor-property',
            ['static-get-method', 'static-set-method'],
            'protected-static-decorated-property',
            'protected-static-property',
            'protected-static-accessor-property',
            ['protected-static-get-method', 'protected-static-set-method'],
            'private-static-decorated-property',
            'private-static-property',
            'private-static-accessor-property',
            ['private-static-get-method', 'private-static-set-method'],
            'static-block',
            // ── Instance fields ───────────────────────────────────
            'declare-property',
            'abstract-property',
            'abstract-accessor-property',
            ['abstract-get-method', 'abstract-set-method'],
            'decorated-property',
            'property',
            'accessor-property',
            ['get-method', 'set-method'],
            'protected-decorated-property',
            'protected-property',
            'protected-accessor-property',
            ['protected-get-method', 'protected-set-method'],
            'private-decorated-property',
            'private-property',
            'private-accessor-property',
            ['private-get-method', 'private-set-method'],
            // ── Constructor ───────────────────────────────────────
            'constructor',
            // ── Homey lifecycle hooks ─────────────────────────────
            'homey-lifecycle-init',
            'homey-lifecycle-pair',
            'homey-lifecycle-repair',
            'homey-lifecycle-settings',
            'homey-lifecycle-deleted',
            'homey-lifecycle-uninit',
            // ── Static methods ────────────────────────────────────
            'static-decorated-method',
            'static-function-property',
            'static-method',
            'protected-static-decorated-method',
            'protected-static-function-property',
            'protected-static-method',
            'private-static-decorated-method',
            'private-static-function-property',
            'private-static-method',
            // ── Instance methods ──────────────────────────────────
            'abstract-method',
            'decorated-method',
            'function-property',
            'method',
            'protected-decorated-method',
            'protected-function-property',
            'protected-method',
            'private-decorated-method',
            'private-function-property',
            'private-method',
            // ── Unknown (catch-all) ───────────────────────────────
            'unknown',
          ],
          newlinesBetween: 1,
          newlinesInside: 1,
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
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('side-effect-style'),
            ...buildImportGroup('style'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('builtin'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('external'),
            ...buildImportGroup('tsconfig-path'),
            ...buildImportGroup('subpath'),
            ...buildImportGroup('internal'),
            {
              newlinesBetween: 1,
            },
            ...buildImportGroup('parent'),
            ...buildImportGroup('sibling'),
            ...buildImportGroup('index'),
          ],
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
            ['declare-interface', 'declare-type'],
            'declare-function',
            'declare-class',
            'enum',
            ['interface', 'type'],
            'function',
            'class',
            'export-enum',
            ['export-interface', 'export-type'],
            'export-function',
            'export-class',
            'export-default-enum',
            ['export-default-interface', 'export-default-type'],
            'export-default-function',
            'export-default-class',
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
      'unicorn/no-keyword-prefix': 'off',
      'unicorn/no-null': 'off',
      'unicorn/no-useless-switch-case': 'off',
      'unicorn/prefer-export-from': [
        'error',
        {
          ignoreUsedVariables: true,
        },
      ],
      'unicorn/prevent-abbreviations': 'off',
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
        partitionByComment: false,
        partitionByNewLine: false,
        type: 'custom',
      },
    },
  },
  {
    ...jsdoc({ config: 'flat/recommended-typescript-error' }),
    files: ['**/api.mts'],
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
    files: ['lib/homey.mts'],
    rules: {
      'import-x/no-extraneous-dependencies': 'off',
      'import-x/no-named-as-default-member': 'off',
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
    files: ['settings/index.mts'],
    rules: {
      'max-classes-per-file': 'off',
    },
  },
  {
    files: ['**/*.config.{ts,js}'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
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
    files: ['eslint-utils/**'],
    rules: {
      '@typescript-eslint/naming-convention': 'off',
    },
  },
  {
    extends: ['html/all'],
    files: ['**/*.html'],
    language: 'html/html',
    plugins: {
      html,
    },
    rules: {
      'html/no-empty-headings': 'off',
      'html/require-open-graph-protocol': 'off',
      'html/use-baseline': [
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
      'markdown/fenced-code-meta': 'error',
      'markdown/no-bare-urls': 'error',
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
    },
  },
  {
    extends: [vitest.configs.all, vitest.configs.recommended],
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      'vitest/max-expects': 'off',
      'vitest/no-disabled-tests': 'error',
      'vitest/no-hooks': 'off',
      'vitest/prefer-expect-assertions': 'off',
      'vitest/require-hook': 'off',
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
  },
  {
    files: ['tests/unit/app.test.ts'],
    rules: {
      '@typescript-eslint/init-declarations': 'off',
    },
  },
  {
    files: ['tests/unit/app.test.ts', 'tests/unit/*-{device,driver}.test.ts'],
    rules: {
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    extends: [ymlConfigs.standard, ymlConfigs.prettier],
    rules: {
      'yml/file-extension': [
        'error',
        {
          extension: 'yml',
        },
      ],
      'yml/require-string-key': 'error',
      'yml/sort-keys': [
        'error',
        {
          order: {
            caseSensitive: true,
            natural: true,
            type: 'asc',
          },
          pathPattern: String.raw`^(?!jobs\.\w+\.steps\[\d+\]).*$`,
        },
        {
          order: ['id', 'name', 'if', 'uses', 'with', 'env', 'run'],
          pathPattern: String.raw`^jobs\.\w+\.steps\[\d+\]$`,
        },
      ],
      'yml/sort-sequence-values': [
        'error',
        {
          order: {
            caseSensitive: true,
            natural: true,
            type: 'asc',
          },
          pathPattern: '^.*$',
        },
      ],
    },
  },
  {
    extends: [packageJsonConfigs.recommended, packageJsonConfigs.stylistic],
    files: ['**/package.json'],
    rules: {
      'package-json/require-exports': 'off',
      'package-json/require-files': 'off',
    },
  },
])

export default config
