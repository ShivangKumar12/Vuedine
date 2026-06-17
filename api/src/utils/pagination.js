import { z } from 'zod';

/**
 * Two pagination modes:
 *
 *   offset   ?page=1&pageSize=20         → simple, breaks on inserts mid-scroll, fine for admin lists
 *   cursor   ?cursor=<opaque>&limit=50   → stable, recommended for high-velocity feeds (orders, messages)
 *
 * Both produce a `meta` block matching the envelope shape:
 *   meta: { page, pageSize, total, totalPages }    // offset
 *   meta: { nextCursor, prevCursor, hasMore }      // cursor
 *
 * Pick one per route and stick to it — frontends can't paginate two ways.
 */

export const offsetSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const cursorSchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export function offsetMeta({ page, pageSize, total }) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Encode a cursor payload as URL-safe base64. Cursor payload is opaque to the
 * client — they just round-trip whatever they got. We can include `id` and
 * `createdAt` so the next page is `WHERE (createdAt, id) > (...)`.
 */
export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
