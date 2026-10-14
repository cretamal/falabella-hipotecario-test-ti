// @ts-check
const eslint = require('@eslint/js');
const { defineConfig } = require('eslint/config');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = defineConfig([
  {
    files: ['**/*.ts'],
    extends: [eslint.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic, angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      // Nombres "intención sobre rol" (Angular 20+): `catalog.ts` / `Catalog`, sin sufijos.
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/prefer-inject': 'error',
    },
  },
  // Atomic Design: las importaciones solo apuntan "hacia abajo" (átomo < molécula < organismo < plantilla < página).
  // Fuera de las páginas no se inyectan servicios de datos: ni HttpClient, ni core/, ni el dominio (pokemon/).
  ...[
    ['atoms', ['molecules', 'organisms', 'templates']],
    ['molecules', ['organisms', 'templates']],
    ['organisms', ['templates']],
    ['templates', []],
  ].map(([layer, upper]) => ({
    files: [`src/app/ui/${layer}/**/*.ts`],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...upper.map((name) => ({
              regex: `^\\.{1,2}/(.*/)?${name}/`,
              message: `Atomic Design: «${layer}» no puede depender de «${name}».`,
            })),
            { regex: '^\\.{1,2}/(.*/)?pages/', message: 'Atomic Design: la UI no depende de las páginas.' },
            { regex: '^\\.{1,2}/(.*/)?(core|pokemon)/', message: 'Atomic Design: la UI es presentacional (sin servicios ni dominio).' },
            { group: ['@angular/common/http'], message: 'Atomic Design: solo las páginas acceden a datos.' },
          ],
        },
      ],
    },
  })),
  {
    files: ['**/*.html'],
    extends: [angular.configs.templateRecommended, angular.configs.templateAccessibility],
    rules: {},
  },
  { ignores: ['dist/', '.angular/', 'playwright-report/', 'test-results/'] },
]);
