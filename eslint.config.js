import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  // Compiled output and generated files are not linted.
  { ignores: ['dist/**', 'node_modules/**', '.husky/**', 'src/**/*.js', 'playwright-report/**', 'test-results/**', 'mcp/dist/**', 'mcp/app/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // Dev tooling runs in Node.
  {
    files: ['scripts/**/*.mjs', 'tools/**/*.mjs', 'tools/**/*.ts', 'eslint.config.js', 'vitest.config.ts', 'vite.config.ts', 'e2e/playwright.config.ts', 'mcp/scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // The MCP server is a second artefact, in node, outside the app's four layers.
  {
    files: ['mcp/src/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Ambient declarations for third-party globals may need loose types.
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
