/**
 * PM2 ecosystem (CommonJS — PM2 still reads configs as CJS).
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 reload api          # zero-downtime
 *   pm2 monit               # live dashboard
 *   pm2-runtime ecosystem.config.cjs   # in containers (PM2 as PID 1)
 *
 * Two app definitions:
 *   - `api`     — cluster mode, one Node instance per CPU core
 *   - `worker`  — fork mode (no port binding), N replicas for queue throughput
 *
 * Tuning notes:
 *   - `kill_timeout` MUST be > server.js's SHUTDOWN_TIMEOUT_MS (25s) so PM2
 *     gives the process a chance to drain before SIGKILL.
 *   - `wait_ready: true` makes PM2 wait for `process.send('ready')` before
 *     considering an instance online — meaning rolling reloads don't drop
 *     traffic onto a half-booted process.
 *   - `max_memory_restart` is a backstop for memory leaks; absolute number
 *     should be < container limit so PM2 reaps before the OOM killer does.
 */

/* eslint-disable no-process-env -- PM2 ecosystem runs before our config loader */

module.exports = {
  apps: [
    {
      name: 'api',
      script: 'src/server.js',
      exec_mode: 'cluster',
      instances: process.env.PM2_INSTANCES || 'max',
      max_memory_restart: '512M',
      kill_timeout: 26000,
      wait_ready: true,
      listen_timeout: 10000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,

      env: { NODE_ENV: 'development' },
      env_staging: { NODE_ENV: 'staging' },
      env_production: { NODE_ENV: 'production' },

      out_file: '/dev/null',
      error_file: '/dev/null',
      merge_logs: true,
    },
    {
      name: 'worker',
      script: 'src/queues/workers/index.js',
      exec_mode: 'fork',
      instances: process.env.PM2_WORKER_INSTANCES || 2,
      max_memory_restart: '768M',
      kill_timeout: 35000,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,

      env: { NODE_ENV: 'development' },
      env_staging: { NODE_ENV: 'staging' },
      env_production: { NODE_ENV: 'production' },

      out_file: '/dev/null',
      error_file: '/dev/null',
      merge_logs: true,
    },
  ],
};
