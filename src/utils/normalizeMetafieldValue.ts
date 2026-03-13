/**
 * Normalize metafield values to Shopify's expected format when writing to products.json.
 * So the importer can pass values through without conversion.
 * - date_time → YYYY-MM-DDTHH:MM:SS
 * - date → YYYY-MM-DD
 */

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
// Matches a datetime with optional fractional seconds but no timezone indicator
const DATETIME_NO_TZ_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/

export const normalizeMetafieldValue = (type: string, value: string): string => {
  const v = value.trim()
  if (!v) return v
  const lower = type.toLowerCase()
  if (lower !== 'date_time' && lower !== 'date') return v
  if (lower === 'date_time' && DATE_TIME_RE.test(v)) return v
  if (lower === 'date' && DATE_ONLY_RE.test(v)) return v
  // Treat timezone-less datetime strings as UTC to avoid local-time shifts
  const vUtc = DATETIME_NO_TZ_RE.test(v) ? `${v}Z` : v
  const d = new Date(vUtc)
  if (Number.isNaN(d.getTime())) return v
  if (lower === 'date') return d.toISOString().slice(0, 10)
  return d.toISOString().slice(0, 19)
}
