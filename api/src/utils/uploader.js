import { Readable } from 'node:stream';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';

import { env } from '../config/index.js';
import { logger } from '../config/logger.js';

import { AppError } from './AppError.js';

/**
 * File-upload adapter.
 *
 * Two paths:
 *   1. Server-side put (small files <5MB): use `upload` (multer memoryStorage)
 *      then call `putObject` from a controller.
 *   2. Direct-to-S3 (>5MB or anything large): client requests a presigned PUT
 *      URL via `getPresignedPutUrl`, then PUTs straight to S3. Keeps big
 *      files off the API tier — meaningful for menu image uploads at scale.
 *
 * Lazily constructs the S3 client so the dev server starts without S3 creds.
 * If a route that NEEDS S3 is hit without configuration, it throws a clear
 * 503 instead of a cryptic AWS SDK error.
 */

const ALLOWED_IMAGE_RE = /^image\/(png|jpeg|webp|svg\+xml)$/;

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  if (!env.S3_BUCKET) {
    throw AppError.dependencyDown('Object storage not configured', 'S3_NOT_CONFIGURED');
  }
  _s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT || undefined,
    forcePathStyle: !!env.S3_ENDPOINT, // for MinIO / Cloudflare R2
    credentials: env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  });
  logger.info('s3.client_initialized', { region: env.S3_REGION, bucket: env.S3_BUCKET });
  return _s3;
}

/* ----- multer middleware (memory storage, 10MB cap, image-only by default) ----- */

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_IMAGE_RE.test(file.mimetype)) {
      return cb(
        AppError.unsupportedMedia(`Unsupported file type: ${file.mimetype}`, 'UNSUPPORTED_MEDIA'),
      );
    }
    cb(null, true);
  },
});

/** Direct put, for files we own end-to-end. Returns the public URL. */
export async function putObject({
  key,
  body,
  contentType,
  cacheControl = 'public, max-age=31536000',
}) {
  const s3 = getS3();
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body instanceof Readable ? body : body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );
  return env.S3_PUBLIC_URL ? `${env.S3_PUBLIC_URL}/${key}` : `s3://${env.S3_BUCKET}/${key}`;
}

/**
 * Browser-direct upload via presigned URL.
 * Client PUTs to the returned URL with the same `Content-Type`. Works against
 * AWS S3, MinIO, Cloudflare R2.
 */
export async function getPresignedPutUrl({ key, contentType, expiresInSec = 600 }) {
  const s3 = getS3();
  const cmd = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSec });
}
