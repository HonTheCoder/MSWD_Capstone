module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  plugins: ['prettier', '@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  rules: {
    'prettier/prettier': 'error',
    'no-console': 'warn',
    'no-unused-vars': 'off', // Turn off base rule
    '@typescript-eslint/no-unused-vars': 'error',
    'no-undef': 'off', // TypeScript handles this
    '@typescript-eslint/no-explicit-any': 'off', // Allow any during migration
    '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore during migration
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': 'error',
    'arrow-spacing': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'eol-last': 'error',
    'comma-dangle': ['error', 'never'],
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { avoidEscape: true }]
  },
  globals: {
    // Firebase globals
    firebase: 'readonly',
    db: 'readonly',
    auth: 'readonly',
    
    // Chart.js and other external libraries
    Chart: 'readonly',
    ChartDataLabels: 'readonly',
    Swal: 'readonly',
    
    // Custom globals
    showSuccess: 'readonly',
    showError: 'readonly',
    showWarning: 'readonly',
    showInfo: 'readonly',
    ErrorHandler: 'readonly',
    ResourceLoader: 'readonly',
    PriorityCalculator: 'readonly'
  },
  ignorePatterns: [
    'node_modules/',
    'coverage/',
    'dist/',
    '*.min.js',
    '*.d.ts'
  ],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off'
      }
    },
    {
      files: ['*.js', '*.jsx'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};