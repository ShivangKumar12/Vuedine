/**
 * Pre-test bootstrap — loaded via jest's `setupFiles`.
 *
 * Runs BEFORE any src module imports. Two responsibilities:
 *   1. Force NODE_ENV=test so anything that branches on env behaves correctly.
 *   2. Load `.env.test` over the existing process.env (overriding any dev
 *      values that might leak in from a developer's shell).
 */
import { config as loadDotenv } from 'dotenv';

process.env.NODE_ENV = 'test';
loadDotenv({ path: '.env.test', override: true });
