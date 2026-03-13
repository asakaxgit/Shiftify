import path from 'node:path'
import fs from 'fs-extra'
import { type Workbook, getSheetAsRows, readWorkbook } from '#adapters/xlsx'
import type { MetafieldDefinition } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

/** Namespace/key part: non-dot, or backslash-escaped char (so \. is part of name, not separator). */
const NS_KEY_PART = '(?:[^.\\\\]|\\\\.)*'
const PRODUCT_METAFIELD_RE = new RegExp(
  `^Metafield:\\s*(${NS_KEY_PART})\\.(${NS_KEY_PART})\\s*\\[([^\\]]+)\\]$`,
)
const VARIANT_METAFIELD_RE = new RegExp(
  `^Variant Metafield:\\s*(${NS_KEY_PART})\\.(${NS_KEY_PART})\\s*\\[([^\\]]+)\\]$`,
)
/** Alternate Matrixify format: "Label (product.metafields.namespace.key)" — type not in header, defaulted. */
const ALT_METAFIELD_RE =
  /^(.+?)\s*\((product|product_variant|collection)\.metafields\.([^.]+)\.([^)]+)\)$/

const OWNER_PRODUCT = 'PRODUCT'
const OWNER_PRODUCT_VARIANT = 'PRODUCTVARIANT'
const OWNER_COLLECTION = 'COLLECTION'

const DEFAULT_METAFIELD_TYPE = 'single_line_text_field'

/** Shopify built-in namespaces (e.g. discovery, recommendations) — not custom metafield definitions. */
const BUILTIN_NAMESPACE_PREFIX = 'shopify--'

const unescapeDots = (s: string): string => s.replace(/\\\./g, '.')

const isBuiltinNamespace = (namespace: string): boolean =>
  namespace.startsWith(BUILTIN_NAMESPACE_PREFIX)

const humanName = (namespace: string, key: string): string => key || `${namespace}_field`

const getHeadersFromRows = (rows: Record<string, unknown>[]): string[] =>
  rows.length > 0 ? Object.keys(rows[0]) : []

type InferredDef = {
  namespace: string
  key: string
  type: string
  ownerType: string
  name?: string
}

const OWNER_MAP: Record<string, string> = {
  product: OWNER_PRODUCT,
  product_variant: OWNER_PRODUCT_VARIANT,
  collection: OWNER_COLLECTION,
}

const parseHeadersForOwner = (headers: string[], ownerType: string): InferredDef[] => {
  const defs: InferredDef[] = []
  const variant = ownerType === OWNER_PRODUCT_VARIANT
  const re = variant ? VARIANT_METAFIELD_RE : PRODUCT_METAFIELD_RE
  for (const header of headers) {
    const s = String(header).trim()
    const m = s.match(re)
    if (!m) continue
    const [, ns, key, type] = m
    if (!ns || !key || !type) continue
    defs.push({
      namespace: unescapeDots(ns.trim()),
      key: unescapeDots(key.trim()),
      type: type.trim(),
      ownerType,
    })
  }
  return defs
}

/** Parse "Label (owner.metafields.namespace.key)" style headers; type defaulted. */
const parseHeadersAlt = (headers: string[]): InferredDef[] => {
  const defs: InferredDef[] = []
  for (const header of headers) {
    const s = String(header).trim()
    const m = s.match(ALT_METAFIELD_RE)
    if (!m) continue
    const [, label, owner, namespace, key] = m
    if (!owner || !namespace || !key) continue
    const ownerType = OWNER_MAP[owner]
    if (!ownerType) continue
    const ns = unescapeDots(namespace.trim())
    const k = unescapeDots(key.trim())
    defs.push({
      namespace: ns,
      key: k,
      type: DEFAULT_METAFIELD_TYPE,
      ownerType,
      name: (label && String(label).trim()) || humanName(ns, k),
    })
  }
  return defs
}

/** Exported for unit tests. Infers metafield definitions from column headers in Products and Collections sheets. */
export const inferFromWorkbook = (workbook: Workbook): MetafieldDefinition[] => {
  const seen = new Set<string>()
  const result: MetafieldDefinition[] = []

  const add = (def: InferredDef) => {
    if (isBuiltinNamespace(def.namespace)) return
    const dedupeKey = `${def.ownerType}:${def.namespace}:${def.key}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    result.push({
      name: def.name ?? humanName(def.namespace, def.key),
      namespace: def.namespace,
      key: def.key,
      description: null,
      type: def.type,
      ownerType: def.ownerType,
      pinnedPosition: null,
      validations: [],
    })
  }

  const productRows = getSheetAsRows(workbook, ['Products', 'Product'])
  if (productRows.length > 0) {
    const headers = getHeadersFromRows(productRows as Record<string, unknown>[])
    for (const d of parseHeadersForOwner(headers, OWNER_PRODUCT)) add(d)
    for (const d of parseHeadersForOwner(headers, OWNER_PRODUCT_VARIANT)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  const smartRows = getSheetAsRows(workbook, ['Smart Collections', 'Smart Collection'])
  if (smartRows.length > 0) {
    const headers = getHeadersFromRows(smartRows as Record<string, unknown>[])
    for (const d of parseHeadersForOwner(headers, OWNER_COLLECTION)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  const customRows = getSheetAsRows(workbook, ['Custom Collections', 'Custom Collection'])
  if (customRows.length > 0) {
    const headers = getHeadersFromRows(customRows as Record<string, unknown>[])
    for (const d of parseHeadersForOwner(headers, OWNER_COLLECTION)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  return result
}

export const exportMetafieldDefinitionsFromMatrixifyXlsx = async (
  xlsxPath: string,
  options?: { dryRun?: boolean },
): Promise<void> => {
  const workbook = await readWorkbook(xlsxPath)
  const definitions = inferFromWorkbook(workbook)
  const outPath = path.join(config.DATA_DIR, 'metafield-definitions.json')
  if (options?.dryRun) {
    logger.success(
      `Would write ${definitions.length} metafield definitions (inferred from XLSX) to ${outPath}`,
    )
    return
  }
  await fs.outputJson(outPath, definitions, { spaces: 2 })
  logger.success(
    `Exported ${definitions.length} metafield definitions (inferred from XLSX) → ${outPath}`,
  )
}
