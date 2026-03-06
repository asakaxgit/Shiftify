import path from 'node:path'
import fs from 'fs-extra'
import * as XLSX from 'xlsx'
import type { MetafieldDefinition } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

const PRODUCT_METAFIELD_RE = /^Metafield:\s*(.+?)\.(.+?)\s*\[([^\]]+)\]$/
const VARIANT_METAFIELD_RE = /^Variant Metafield:\s*(.+?)\.(.+?)\s*\[([^\]]+)\]$/
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

const getHeadersFromSheet = (sheet: XLSX.WorkSheet): string[] => {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    header: 1,
  })
  if (rows.length === 0) return []
  const first = rows[0]
  return Array.isArray(first) ? (first as string[]) : Object.keys(first as object)
}

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
export const inferFromWorkbook = (workbook: XLSX.WorkBook): MetafieldDefinition[] => {
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

  const productsSheet = workbook.Sheets.Products ?? workbook.Sheets.Product
  if (productsSheet) {
    const headers = getHeadersFromSheet(productsSheet)
    for (const d of parseHeadersForOwner(headers, OWNER_PRODUCT)) add(d)
    for (const d of parseHeadersForOwner(headers, OWNER_PRODUCT_VARIANT)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  const smartSheet = workbook.Sheets['Smart Collections'] ?? workbook.Sheets['Smart Collection']
  if (smartSheet) {
    const headers = getHeadersFromSheet(smartSheet)
    for (const d of parseHeadersForOwner(headers, OWNER_COLLECTION)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  const customSheet = workbook.Sheets['Custom Collections'] ?? workbook.Sheets['Custom Collection']
  if (customSheet) {
    const headers = getHeadersFromSheet(customSheet)
    for (const d of parseHeadersForOwner(headers, OWNER_COLLECTION)) add(d)
    for (const d of parseHeadersAlt(headers)) add(d)
  }

  return result
}

export const exportMetafieldDefinitionsFromMatrixifyXlsx = async (
  xlsxPath: string,
  options?: { dryRun?: boolean },
): Promise<void> => {
  const buf = await fs.readFile(xlsxPath)
  const workbook = XLSX.read(buf, { type: 'buffer' })
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
