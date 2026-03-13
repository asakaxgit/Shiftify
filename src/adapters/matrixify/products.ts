import path from 'node:path'
import fs from 'fs-extra'
import { getSheetAsRows, hasSheet, readWorkbook } from '#adapters/xlsx'
import type {
  Product,
  ProductImage,
  ProductMetafield,
  ProductOption,
  ProductVariant,
} from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { normalizeMetafieldValue } from '#utils/normalizeMetafieldValue'

type MatrixifyRow = Record<string, string | number | boolean | undefined>

const str = (v: string | number | boolean | undefined): string =>
  v === undefined || v === null ? '' : String(v).trim()
const num = (v: string | number | boolean | undefined): number => {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const PRODUCT_METAFIELD_RE = /^Metafield:\s*(.+?)\.(.+?)\s*\[([^\]]+)\]$/
const VARIANT_METAFIELD_RE = /^Variant Metafield:\s*(.+?)\.(.+?)\s*\[([^\]]+)\]$/
const ALT_METAFIELD_RE =
  /^(.+?)\s*\((product|product_variant|collection)\.metafields\.([^.]+)\.([^)]+)\)$/
const DEFAULT_METAFIELD_TYPE = 'single_line_text_field'
const BUILTIN_NAMESPACE = 'shopify--'
const unescapeDots = (s: string): string => s.replace(/\\\./g, '.')

type MetafieldCol = {
  header: string
  namespace: string
  key: string
  type: string
  owner: 'product' | 'variant'
}

const getMetafieldColumns = (headers: string[]): MetafieldCol[] => {
  const out: MetafieldCol[] = []
  for (const header of headers) {
    const s = String(header).trim()
    let match = s.match(PRODUCT_METAFIELD_RE)
    if (match) {
      const [, ns, key, type] = match
      if (ns && key && type && !unescapeDots(ns.trim()).startsWith(BUILTIN_NAMESPACE)) {
        out.push({
          header,
          namespace: unescapeDots(ns.trim()),
          key: unescapeDots(key.trim()),
          type: type.trim(),
          owner: 'product',
        })
      }
      continue
    }
    match = s.match(VARIANT_METAFIELD_RE)
    if (match) {
      const [, ns, key, type] = match
      if (ns && key && type && !unescapeDots(ns.trim()).startsWith(BUILTIN_NAMESPACE)) {
        out.push({
          header,
          namespace: unescapeDots(ns.trim()),
          key: unescapeDots(key.trim()),
          type: type.trim(),
          owner: 'variant',
        })
      }
      continue
    }
    match = s.match(ALT_METAFIELD_RE)
    if (match) {
      const [, , owner, ns, key] = match
      if (owner === 'product' || owner === 'product_variant') {
        const nsTrim = unescapeDots(ns.trim())
        if (!nsTrim.startsWith(BUILTIN_NAMESPACE)) {
          out.push({
            header,
            namespace: nsTrim,
            key: unescapeDots(key.trim()),
            type: DEFAULT_METAFIELD_TYPE,
            owner: owner === 'product' ? 'product' : 'variant',
          })
        }
      }
    }
  }
  return out
}

const metafieldsFromRow = (row: MatrixifyRow, cols: MetafieldCol[]): ProductMetafield[] => {
  const list: ProductMetafield[] = []
  for (const c of cols) {
    const value = str(row[c.header])
    if (!value) continue
    list.push({
      namespace: c.namespace,
      key: c.key,
      type: c.type,
      value: normalizeMetafieldValue(c.type, value),
    })
  }
  return list
}

const getOptionValues = (row: MatrixifyRow): Array<{ name: string; value: string }> => {
  const options: Array<{ name: string; value: string }> = []
  for (let i = 1; i <= 3; i++) {
    const name = str(row[`Option${i} Name`])
    const value = str(row[`Option${i} Value`])
    if (name && value) options.push({ name, value })
  }
  return options
}

/** Map Matrixify/XLSX weight unit to Shopify GraphQL enum (KILOGRAMS, GRAMS, POUNDS, OUNCES). */
const toShopifyWeightUnit = (raw: string): string => {
  const u = raw.toLowerCase()
  if (u === 'g' || u === 'grams') return 'GRAMS'
  if (u === 'kg' || u === 'kilograms') return 'KILOGRAMS'
  if (u === 'lb' || u === 'lbs' || u === 'pounds') return 'POUNDS'
  if (u === 'oz' || u === 'ounces') return 'OUNCES'
  return 'KILOGRAMS'
}

const rowToVariant = (
  row: MatrixifyRow,
  position: number,
  variantMetafieldCols: MetafieldCol[],
): ProductVariant => {
  const optionValues = getOptionValues(row)
  const title = optionValues.map((o) => o.value).join(' / ') || 'Default Title'
  const weight = num(row['Variant Weight'])
  const weightUnit = toShopifyWeightUnit(str(row['Variant Weight Unit']) || 'kg')
  const metafields = metafieldsFromRow(row, variantMetafieldCols)
  return {
    id: '',
    title,
    sku: str(row['Variant SKU']) || null,
    barcode: str(row['Variant Barcode']) || null,
    price: str(row['Variant Price']) || '0.00',
    compareAtPrice: str(row['Variant Compare At Price']) || null,
    inventoryPolicy: (str(row['Variant Inventory Policy']) || 'deny').toUpperCase(),
    inventoryItem: {
      tracked: str(row['Variant Inventory Tracker']) === 'shopify',
      measurement: {
        weight: weight > 0 ? { unit: weightUnit, value: weight } : null,
      },
    },
    selectedOptions: optionValues,
    position,
    ...(metafields.length > 0 ? { metafields } : {}),
  }
}

const buildOptionsFromVariants = (variants: ProductVariant[]): ProductOption[] => {
  const byName = new Map<string, Set<string>>()
  for (const v of variants) {
    for (const o of v.selectedOptions) {
      if (!o.name) continue
      let set = byName.get(o.name)
      if (!set) {
        set = new Set()
        byName.set(o.name, set)
      }
      set.add(o.value)
    }
  }
  return Array.from(byName.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values),
  }))
}

const collectImages = (rows: MatrixifyRow[]): ProductImage[] => {
  const seen = new Set<string>()
  const images: ProductImage[] = []
  for (const row of rows) {
    const url = str(row['Image Src'])
    if (!url || seen.has(url)) continue
    seen.add(url)
    const altText = str(row['Image Alt Text']) || null
    const position = num(row['Image Position'])
    images.push({
      id: '',
      url,
      altText: altText || null,
      width: num(row['Image Width']) || 0,
      height: num(row['Image Height']) || 0,
    })
  }
  return images.map((img, i) => ({ ...img, id: `img-${i}` }))
}

/** Rows with no option values become "empty" variants that break productSet. Filter them out for multi-row products. */
const variantRows = (rows: MatrixifyRow[]): MatrixifyRow[] => {
  if (rows.length <= 1) return rows
  const withOptions = rows.filter((row) => getOptionValues(row).length > 0)
  return withOptions.length > 0 ? withOptions : rows.slice(0, 1)
}

const rowsToProduct = (
  rows: MatrixifyRow[],
  productMetafieldCols: MetafieldCol[],
  variantMetafieldCols: MetafieldCol[],
): Product => {
  const first = rows[0]
  if (!first) throw new Error('Empty product group')
  const handle =
    str(first.Handle) ||
    str(first.Title)
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '') ||
    'product'
  const tagsStr = str(first.Tags)
  const tags = tagsStr
    ? tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : []
  const forVariants = variantRows(rows)
  const variants: ProductVariant[] = forVariants.map((row, i) =>
    rowToVariant(row, i + 1, variantMetafieldCols),
  )
  const options = buildOptionsFromVariants(variants)
  const images = collectImages(rows)
  const productMetafields = metafieldsFromRow(first, productMetafieldCols)
  return {
    id: '',
    title: str(first.Title) || 'Untitled',
    handle,
    descriptionHtml: str(first['Body HTML']) || '',
    productType: str(first.Type) || '',
    vendor: str(first.Vendor) || '',
    status: (str(first.Status) || 'ACTIVE').toUpperCase(),
    tags,
    options,
    variants: { nodes: variants },
    images: { nodes: images },
    ...(productMetafields.length > 0 ? { metafields: productMetafields } : {}),
  }
}

const parseProductsSheet = (
  rows: MatrixifyRow[],
  productMetafieldCols: MetafieldCol[],
  variantMetafieldCols: MetafieldCol[],
): Product[] => {
  if (rows.length === 0) return []

  const groups: MatrixifyRow[][] = []
  let currentGroup: MatrixifyRow[] = []
  let currentHandle = ''

  for (const row of rows) {
    const rowHandle = str(row.Handle) || currentHandle
    if (rowHandle && rowHandle !== currentHandle && currentGroup.length > 0) {
      groups.push(currentGroup)
      currentGroup = []
    }
    currentHandle = rowHandle || currentHandle
    if (currentHandle) currentGroup.push(row)
  }
  if (currentGroup.length > 0) groups.push(currentGroup)

  return groups.map((g) => rowsToProduct(g, productMetafieldCols, variantMetafieldCols))
}

export const normalizeProductsFromXlsx = async (xlsxPath: string): Promise<Product[]> => {
  const workbook = await readWorkbook(xlsxPath)
  if (!hasSheet(workbook, ['Products', 'Product'])) {
    throw new Error('XLSX has no "Products" or "Product" sheet')
  }
  const rows = getSheetAsRows(workbook, ['Products', 'Product'])
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const allMetafieldCols = getMetafieldColumns(headers)
  const productMetafieldCols = allMetafieldCols.filter((c) => c.owner === 'product')
  const variantMetafieldCols = allMetafieldCols.filter((c) => c.owner === 'variant')
  const products = parseProductsSheet(rows, productMetafieldCols, variantMetafieldCols)
  logger.info(`Parsed ${products.length} products from Matrixify XLSX`)
  return products
}

export const exportProductsFromMatrixifyXlsx = async (
  xlsxPath?: string,
  options?: { dryRun?: boolean },
): Promise<void> => {
  const resolved = xlsxPath || config.SOURCE_XLSX_PATH || path.join(config.DATA_DIR, 'export.xlsx')
  const products = await normalizeProductsFromXlsx(resolved)
  const outPath = path.join(config.DATA_DIR, 'products.json')
  if (options?.dryRun) {
    logger.success(`Would write ${products.length} products to ${outPath}`)
    return
  }
  await fs.outputJson(outPath, products, { spaces: 2 })
  logger.success(`Exported ${products.length} products → ${outPath}`)
}
