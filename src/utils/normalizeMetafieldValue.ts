/**
 * Normalize metafield values to Shopify's expected format when writing to products.json.
 * So the importer can pass values through without conversion.
 * - date_time → YYYY-MM-DDTHH:MM:SS
 * - date → YYYY-MM-DD
 */

const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

export const normalizeMetafieldValue = (type: string, value: string): string => {
  const v = value.trim()
  if (!v) return v
  const lower = type.toLowerCase()
  if (lower !== 'date_time' && lower !== 'date') return v
  if (lower === 'date_time' && DATE_TIME_RE.test(v)) return v
  if (lower === 'date' && DATE_ONLY_RE.test(v)) return v
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  if (lower === 'date') return d.toISOString().slice(0, 10)
  return d.toISOString().slice(0, 19)
}
