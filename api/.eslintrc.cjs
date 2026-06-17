module.exports = {
  root: true,
  env: { node: true, es2022: true, jest: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  extends: [
    'eslint:recommended',
    'plugin:n/recommended',
    'plugin:security/recommended-legacy',
    'prettier',
  ],
  plugins: ['import', 'n', 'security'],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js'] },
    },
  },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // process.exit is intentional in env validation (fail fast) and graceful shutdown.
    'n/no-process-exit': 'off',
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    // Force every env read through src/config/env.js so we never default secrets.
    'no-process-env': 'error',

    // Pure-JS ESM project — turn off rules that assume CJS or TypeScript.
    'n/no-missing-import': 'off', // handled by Node's own resolution + Jest moduleNameMapper later
    'n/no-unsupported-features/node-builtins': 'off',
    'n/no-unpublished-import': 'off',
    'n/no-extraneous-import': 'off',

    // security/detect-object-injection is too noisy for legitimate dynamic dispatch.
    'security/detect-object-injection': 'off',
    // We use template literals in queries via Prisma — Prisma escapes parameters itself.
    'security/detect-non-literal-regexp': 'warn',
    // Setup scripts read from constructed paths under our own repo — not user input.
    'security/detect-non-literal-fs-filename': 'off',

    // Block the only Prisma escape hatch that risks SQL injection.
    'no-restricted-properties': [
      'error',
      {
        object: 'prisma',
        property: '$queryRawUnsafe',
        message: 'Use $queryRaw with template literals — $queryRawUnsafe risks SQL injection.',
      },
      {
        object: 'prisma',
        property: '$executeRawUnsafe',
        message: 'Use $executeRaw with template literals — $executeRawUnsafe risks SQL injection.',
      },
    ],
  },
  overrides: [
    {
      // The single place where reading process.env is allowed.
      files: ['src/config/env.js'],
      rules: { 'no-process-env': 'off' },
    },
    {
      // PM2 ecosystem runs BEFORE our config loader exists.
      files: ['ecosystem.config.js'],
      rules: { 'no-process-env': 'off' },
    },
    {
      // Jest config reads CI flag for verbose mode — runs before src loads.
      files: ['jest.config.js', 'tests/env.js'],
      rules: { 'no-process-env': 'off' },
    },
    {
      files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
      rules: {
        'no-process-env': 'off',
        'security/detect-non-literal-fs-filename': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'coverage/',
    'logs/',
    'prisma/migrations/',
    'docs/openapi.json',
    'docs/postman.json',
    'tests/load/', // k6 scripts import 'k6/http' which Node can't resolve
  ],
};
