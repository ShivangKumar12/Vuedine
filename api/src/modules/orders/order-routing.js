/**
 * Item → station routing.
 *
 *   Pizza, Burger, Pasta, Indian, Asian, Mains, Appetizers → HOT
 *   Salads, Sushi → COLD
 *   Wines, Cocktails, Beverages (alcoholic) → BAR
 *   Desserts → DESSERT
 *
 * Resolution order:
 *   1. Per-line override (caller passes `station` on the line)
 *   2. Item.category → predefined map
 *   3. Default HOT
 */

const CATEGORY_TO_STATION = {
  Appetizers: 'HOT',
  Pizza: 'HOT',
  Burgers: 'HOT',
  Pasta: 'HOT',
  Mains: 'HOT',
  Indian: 'HOT',
  Asian: 'HOT',
  Salads: 'COLD',
  Sushi: 'COLD',
  Desserts: 'DESSERT',
  Wines: 'BAR',
  Cocktails: 'BAR',
  Beverages: 'BAR',
};

export function resolveStation({ category, override }) {
  if (override && CATEGORY_TO_STATION[override] !== undefined) return override;
  if (override) return override;
  if (!category) return 'HOT';
  return CATEGORY_TO_STATION[category] ?? 'HOT';
}

/**
 * Pick the dominant station for the order itself (used for routing the whole
 * ticket on KDS when no station mix is provided). Take whichever station has
 * the highest aggregate qty.
 */
export function pickPrimaryStation(lines) {
  if (!lines.length) return 'HOT';
  const counts = {};
  for (const l of lines) {
    counts[l.station] = (counts[l.station] ?? 0) + Number(l.qty || 1);
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
