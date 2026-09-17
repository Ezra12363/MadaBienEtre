const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const globals = require('globals');

module.exports = [
  // ============================================================
  // IGNORE
  // ============================================================
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'build/**',
      'web-build/**',
      'android/**',
      'ios/**',
      'coverage/**',
      '*.min.js',
    ],
  },

  // ============================================================
  // ESLINT RECOMMENDED
  // ============================================================
  js.configs.recommended,

  // ============================================================
  // REACT / REACT NATIVE
  // ============================================================
  {
    files: ['**/*.js', '**/*.jsx'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',

      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },

      globals: {
        // Browser / Expo Web
        ...globals.browser,

        // Node / Expo configuration
        ...globals.node,

        // Common globals
        console: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        navigator: 'readonly',

        // Timers
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      // --------------------------------------------------------
      // JavaScript
      // --------------------------------------------------------

      'no-undef': 'error',

      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],

      'no-console': 'off',

      'no-extra-boolean-cast': 'warn',

      'no-useless-assignment': 'warn',

      // --------------------------------------------------------
      // React
      // --------------------------------------------------------

      'react/jsx-uses-react': 'off',

      'react/react-in-jsx-scope': 'off',

      // --------------------------------------------------------
      // React Hooks
      // --------------------------------------------------------

      'react-hooks/rules-of-hooks': 'error',

      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ============================================================
  // CONFIG FILES NODE.JS
  // ============================================================
  {
    files: [
      '*.config.js',
      '*.config.cjs',
      'babel.config.js',
      'metro.config.js',
      'eslint.config.js',
    ],

    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];