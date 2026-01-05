/**
 * ESLint flat config for application sources and tests.
 */
import globals from 'globals';
import pluginJs from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/'
    ]
  },
  // Recommended JavaScript rules
  pluginJs.configs.recommended,

  // Recommended Vue.js rules for flat config
  ...pluginVue.configs['flat/recommended'],

  {
    files: ['**/*.{js,vue,cjs}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      // Your custom rules override or add to the recommended ones
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'eqeqeq': ['error', 'always'],
      'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_e' }],
      'complexity': ['warn', 10],
      'max-len': ['warn', {
        'code': 120,
        'ignoreUrls': true,
        'ignoreStrings': true,
        'ignoreTemplateLiterals': true,
        'ignoreRegExpLiterals': true
      }],
      'max-lines-per-function': ['warn', {
        'max': 80,
        'skipBlankLines': true,
        'skipComments': true,
        'IIFEs': false
      }],

      // Vue.js specific rules (these will override if already in flat/recommended, or add new ones)
      'vue/multi-word-component-names': 'off',
      'vue/require-explicit-emits': 'error',
      'vue/html-self-closing': ['error', {
        'html': {
          'void': 'always',
          'normal': 'always',
          'component': 'always'
        },
        'svg': 'always',
        'math': 'always'
      }],
      'vue/attributes-order': ['error', {
        'order': [
          'DEFINITION',
          'LIST_RENDERING',
          'CONDITIONALS',
          'RENDER_MODIFIERS',
          'GLOBAL',
          'UNIQUE',
          'SLOT',
          'TWO_WAY_BINDING',
          'OTHER_DIRECTIVES',
          'OTHER_ATTR',
          'EVENTS',
          'CONTENT'
        ],
        'alphabetical': false
      }],
      'vue/no-v-html': 'warn',
      'vue/no-unused-components': 'warn',
      'vue/no-unused-vars': ['warn', { 'ignorePattern': '^_e' }],
    },
  },
  {
    files: ['**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
    rules: {
      'complexity': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'max-lines-per-function': ['warn', {
        'max': 400,
        'skipBlankLines': true,
        'skipComments': true,
        'IIFEs': false
      }],
    }
  },
  // Prettier config should be last to override other formatting rules
  prettierConfig,
]; 
