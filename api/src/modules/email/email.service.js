import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nodemailer from 'nodemailer';

import { env } from '../../config/index.js';
import { logger } from '../../config/logger.js';

/**
 * Email transport + template rendering.
 *
 * In dev / test (no SMTP_HOST) → returns a `noop` messageId so workers don't
 * choke on a missing config; useful in CI and during early development.
 *
 * Template rendering is deliberately tiny — `{{var}}` interpolation only.
 * Swap to handlebars / mjml when conditional blocks become unavoidable.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, 'templates');

let _transporter = null;
function getTransporter() {
  if (_transporter) return _transporter;
  if (!env.SMTP_HOST) return null;
  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return _transporter;
}

const templateCache = new Map();

async function renderTemplate(name, data) {
  if (!templateCache.has(name)) {
    const file = path.join(TEMPLATE_DIR, `${name}.html`);
    templateCache.set(name, await readFile(file, 'utf8'));
  }
  let html = templateCache.get(name);
  for (const [key, value] of Object.entries(data ?? {})) {
    html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
  }
  return html;
}

export const emailService = {
  async send({ to, subject, template, data }) {
    // Render template FIRST so a missing template fails loudly even in noop mode.
    // (Test/dev environments without SMTP still validate the template name.)
    const html = await renderTemplate(template, data);

    const transporter = getTransporter();
    if (!transporter) {
      logger.warn('email.skipped', { reason: 'SMTP not configured', to, subject, template });
      return { messageId: 'noop' };
    }
    const result = await transporter.sendMail({
      from: env.SMTP_FROM ?? env.SMTP_USER,
      to,
      subject,
      html,
    });
    return { messageId: result.messageId };
  },

  async verifyConnection() {
    const t = getTransporter();
    if (!t) return false;
    return t.verify();
  },

  async close() {
    if (_transporter) {
      _transporter.close();
      _transporter = null;
    }
  },
};
