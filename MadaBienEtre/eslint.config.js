// eslint.config.js
const js = require('@eslint/js');
const react = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const globals = require('globals');

// Compat : certaines versions de eslint-plugin-react-hooks exportent
// leurs règles sous `.default` (interop ESM/CJS), ou pas du tout sous
// la forme attendue. On sécurise l'accès à 100% pour ne jamais référencer
// une règle qui n'existe pas ("Definition for rule ... was not found").
const reactHooks =
  (reactHooksPlugin && reactHooksPlugin.rules && reactHooksPlugin) ||
  (reactHooksPlugin && reactHooksPlugin.default && reactHooksPlugin.default.rules && reactHooksPlugin.default) ||
  null;

const hasExhaustiveDeps = !!(reactHooks && reactHooks.rules && reactHooks.rules['exhaustive-deps']);

// Globals explicites pour l'environnement React Native / Expo (web + natif).
// On ne se fie pas uniquement au package "globals" (sa version peut varier
// selon les machines/CI et ne pas couvrir fetch/Blob/File/FormData/URL...),
// donc on les déclare nous-mêmes en plus, pour que le lint soit identique
// en local et sur le CI (GitHub Actions).
const reactNativeGlobals = {
  __DEV__: 'readonly',

  // Timers
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  queueMicrotask: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',

  // Console
  console: 'readonly',

  // Réseau / navigateur (utilisés côté Expo Web et par certains écrans admin)
  fetch: 'readonly',
  Headers: 'readonly',
  Request: 'readonly',
  Response: 'readonly',
  AbortController: 'readonly',
  FormData: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  FileReader: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  XMLHttpRequest: 'readonly',
  WebSocket: 'readonly',
  navigator: 'readonly',
  window: 'readonly',
  document: 'readonly',
  alert: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',

  // Node / bundler (Metro, config, etc.)
  process: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  global: 'readonly',
  Buffer: 'readonly',
};

const commonGlobals = {
  ...globals.browser,
  ...globals.node,
  ...reactNativeGlobals,
};

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
  // OPTIONS ESLINT
  // ============================================================
  {
    linterOptions: {
      // Les commentaires eslint-disable existants ne génèrent pas
      // de warning s'ils deviennent inutiles.
      reportUnusedDisableDirectives: 'off',
    },
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

      globals: commonGlobals,
    },

    plugins: {
      react,
      ...(reactHooks ? { 'react-hooks': reactHooks } : {}),
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
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      'no-console': 'off',
      'no-extra-boolean-cast': 'warn',
      'no-useless-assignment': 'warn',

      // --------------------------------------------------------
      // React
      // --------------------------------------------------------
      // JSX automatic runtime (babel-preset-expo) : pas besoin d'importer React
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      // Marque les composants utilisés uniquement dans le JSX comme "utilisés"
      'react/jsx-uses-vars': 'error',

      // --------------------------------------------------------
      // React Hooks
      // --------------------------------------------------------
      // Si le plugin react-hooks n'est pas chargeable ou n'expose pas la
      // règle (version incompatible avec le flat config), on désactive
      // proprement au lieu de faire planter le lint avec
      // "Definition for rule ... was not found".
      ...(reactHooks ? { 'react-hooks/rules-of-hooks': 'error' } : {}),
      ...(hasExhaustiveDeps ? { 'react-hooks/exhaustive-deps': 'warn' } : {}),
    },
  },

  // ============================================================
  // FICHIERS DE CONFIG (Node.js)
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
        ...reactNativeGlobals,
      },
    },
  },
];