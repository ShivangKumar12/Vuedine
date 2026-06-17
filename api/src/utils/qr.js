import { randomBytes } from 'node:crypto';

import QRCode from 'qrcode';

import { env } from '../config/index.js';

/** 16-char base64url token (≈96 bits — see Phase G pitfall #1). */
export function mintQrToken() {
  return randomBytes(12).toString('base64url');
}

/** Public URL the QR encodes — hits the scan resolver, which records + redirects. */
export function buildQrUrl({ branchSlug, token }) {
  return `${env.PUBLIC_QR_BASE}/m/${branchSlug}/${token}`;
}

/** Where the resolver redirects a scanner to (guest PWA). */
export function buildAppRedirect({ branchSlug, token }) {
  return `${env.PUBLIC_APP_URL}/m/${branchSlug}/${token}`;
}

/** Generate a PNG data URL thumbnail for a QR. Best-effort; returns null on failure. */
export async function qrPngDataUrl(value) {
  try {
    return await QRCode.toDataURL(value, { margin: 1, width: 256, errorCorrectionLevel: 'M' });
  } catch {
    return null;
  }
}

/** Generate a PNG buffer for embedding in a PDF. */
export function qrPngBuffer(value) {
  return QRCode.toBuffer(value, { margin: 1, width: 320, errorCorrectionLevel: 'M' });
}
