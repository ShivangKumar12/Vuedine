/**
 * Generate the committed OpenAPI spec + Postman collection.
 *
 *   npm run docs:generate
 *
 * Outputs:
 *   docs/openapi.json   — committed; CI diff-checks this against the live spec
 *   docs/postman.json   — committed; QA imports this into Postman
 *
 * Why commit both?
 *   1. PRs that modify routes naturally show the spec delta — much easier to
 *      review than reading every JSDoc block.
 *   2. The Postman collection is consumable by humans without running the API.
 *   3. The CI step `git diff --exit-code docs/openapi.json` blocks a route
 *      change that wasn't documented (or vice versa).
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { openapiSpec } from './openapi.js';

const OUT_OPENAPI = 'docs/openapi.json';
const OUT_POSTMAN = 'docs/postman.json';

mkdirSync(dirname(OUT_OPENAPI), { recursive: true });

writeFileSync(OUT_OPENAPI, JSON.stringify(openapiSpec, null, 2) + '\n');
// eslint-disable-next-line no-console -- this IS the CLI's output
console.log(`✓ wrote ${OUT_OPENAPI}`);

// Validate the spec — catches missing $refs, malformed responses, etc.
try {
  execSync(`npx --yes @apidevtools/swagger-cli validate ${OUT_OPENAPI}`, {
    stdio: 'inherit',
  });
} catch {
  // eslint-disable-next-line no-console
  console.error('✗ swagger-cli validate failed');
  process.exit(1);
}

// Convert to Postman v2.1 collection.
try {
  execSync(
    `npx --yes openapi2postmanv2 -s ${OUT_OPENAPI} -o ${OUT_POSTMAN} -p -O folderStrategy=Tags`,
    { stdio: 'inherit' },
  );
  // eslint-disable-next-line no-console
  console.log(`✓ wrote ${OUT_POSTMAN}`);
} catch {
  // eslint-disable-next-line no-console
  console.error('✗ openapi2postmanv2 failed');
  process.exit(1);
}
