/**
 * Husky setup wrapper — tolerant when no git repo or no husky binary is present.
 *
 * The default `husky install` fails when run outside a git repo, which would
 * make `npm install` fail in fresh clones or in CI sandboxes. This wrapper
 * skips gracefully and prints a hint instead.
 *
 * Re-run with: `npm run prepare` after `git init`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '..');
const huskyDir = resolve(apiDir, '.husky');

function findGitRoot(start) {
  let dir = start;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

const gitRoot = findGitRoot(apiDir);
if (!gitRoot) {
  // eslint-disable-next-line no-console
  console.log(
    '⚠️  No git repository detected — skipping husky setup.\n' +
      '   Run `git init` at the workspace root, then `npm run prepare` to enable hooks.',
  );
  process.exit(0);
}

if (!existsSync(resolve(apiDir, 'node_modules', 'husky'))) {
  // eslint-disable-next-line no-console
  console.log('ℹ️  husky not installed yet — skipping (will set up after npm install completes).');
  process.exit(0);
}

const result = spawnSync('npx', ['husky', 'init', huskyDir], {
  cwd: apiDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (result.status !== 0) {
  // eslint-disable-next-line no-console
  console.warn(
    `⚠️  husky init exited with code ${result.status}. Hooks may not be installed. ` +
      `Run \`npx husky init .husky\` from ${apiDir} manually.`,
  );
  // Don't fail npm install over hook setup.
  process.exit(0);
}

// eslint-disable-next-line no-console
console.log(`✅ husky hooks active (gitRoot=${gitRoot}, huskyDir=${huskyDir})`);
