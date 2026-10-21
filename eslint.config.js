import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', 'dist-v2/', 'public/icons/', 'playwright-report/', 'test-results/', 'node_modules/', 'coverage/', 'docs/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
  {
    files: ['tests/**/*.ts', '*.config.ts', '*.config.js', 'scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // User text must never reach the DOM as markup (SPEC-001 security).
      'no-restricted-syntax': [
        'error',
        {
          selector: "AssignmentExpression[left.property.name='innerHTML']",
          message: 'Use textContent / DOM APIs; never innerHTML.',
        },
        {
          selector: "AssignmentExpression[left.property.name='outerHTML']",
          message: 'Use textContent / DOM APIs; never outerHTML.',
        },
      ],
    },
  },
];
