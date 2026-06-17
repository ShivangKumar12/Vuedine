#!/usr/bin/env node
/**
 * setup-env.mjs — idempotent environment bootstrap.
 *
 * Creates api/.env and api/.env.test from api/.env.example, filling every
 * placeholder secret with fresh cryptographic randomness. Safe to re-run:
 * existing real values are preserved; only blank/"change-me" placeholders
 * are replaced.
 *
 * Usage: node scripts/setup-env.mjs
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = resolve(root, 'api');
const examplePath = resolve(apiDir, '.env.example');
const envPath = resolve(apiDir, '.env');
const envTestPath = resolve(apiDir, '.env.test');

const secret = (bytes = 48) => randomBytes(bytes).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 48);

if (!existsSync(examplePath)) {
  console.error('✗ api/.env.example not found — cannot bootstrap env.');
  process.exit(1);
}

const SECRET_KEYS = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'FIELD_ENCRYPTION_KEY', 'METRICS_AUTH_TOKEN'];

function isPlaceholder(v) {
  return !v || v.includes('change-me') || v.trim() === '';
}

function fillSecrets(content) {
  let out = content;
  for (const key of SECRET_KEYS) {
    const re = new RegExp(`^(${key}=)(.*)$`, 'm');
    const m = out.match(re);
    const fresh = secret();
    if (!m) {
      out += `\n${key}=${fresh}\n`;
    } else if (isPlaceholder(m[2])) {
      out = out.replace(re, `$1${fresh}`);
    }
  }
  return out;
}

/* ---- api/.env ---- */
if (existsSync(envPath)) {
  // Top up any still-placeholder secrets without clobbering real values.
  const filled = fillSecrets(readFileSync(envPath, 'utf8'));
  writeFileSync(envPath, filled);
  console.log('✓ api/.env exists — topped up any placeholder secrets');
} else {
  writeFileSync(envPath, fillSecrets(readFileSync(examplePath, 'utf8')));
  console.log('✓ created api/.env with fresh secrets');
}

/* ---- api/.env.test ---- */
if (!existsSync(envTestPath)) {
  let test = fillSecrets(readFileSync(examplePath, 'utf8'));
  const set = (key, val) => {
    const re = new RegExp(`^(${key}=).*$`, 'm');
    test = re.test(test) ? test.replace(re, `$1${val}`) : `${test}\n${key}=${val}`;
  };
  set('NODE_ENV', 'test');
  set('DATABASE_URL', 'postgresql://vuedine:vuedine_dev@localhost:5434/vuedine_test?schema=public');
  set('REDIS_URL', 'redis://localhost:6381/15');
  set('BCRYPT_COST', '4');
  set('RATE_LIMIT_GLOBAL_MAX', '100000');
  set('LOG_LEVEL', 'error');
  writeFileSync(envTestPath, test);
  console.log('✓ created api/.env.test (NODE_ENV=test, vuedine_test DB, fast bcrypt)');
} else {
  console.log('✓ api/.env.test already exists — left untouched');
}

console.log('\nEnvironment ready.');
