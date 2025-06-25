import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        localStorage: 'readonly',
        window: 'readonly',
        document: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLImageElement: 'readonly',
        Event: 'readonly',
        MouseEvent: 'readonly',
        ClipboardEvent: 'readonly',
        requestAnimationFrame: 'readonly',
        Node: 'readonly',
        NodeList: 'readonly',
        NodeListOf: 'readonly',
        DataTransfer: 'readonly',
        global: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        AbortController: 'readonly',
        KeyboardEvent: 'readonly',
        URL: 'readonly',
        navigator: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        Blob: 'readonly',
        BlobPart: 'readonly',
        FilePropertyBag: 'readonly',
        React: 'readonly'
      }
    },
    plugins: {
      '@typescript-eslint': typescript
    },
    rules: {
      ...typescript.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'semi': ['error', 'always'],
      'quotes': ['error', 'single'],
      'indent': ['error', 2],
      'comma-dangle': ['error', 'never'],
      'no-console': ['error', { allow: ['log', 'error', 'warn'] }]
    }
  },
  {
    files: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.spec.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        jest: 'readonly',
        fetch: 'readonly',
        File: 'readonly',
        HTMLImageElement: 'readonly',
        ClipboardEvent: 'readonly',
        Event: 'readonly'
      }
    }
  },
  {
    ignores: ['dist/**', 'src-tauri/**', 'node_modules/**', '*.config.js', '*.config.ts', 'src/test/setup.ts']
  }
];