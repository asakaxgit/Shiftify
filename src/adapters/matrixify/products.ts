import path from 'node:path'
import { outputJson } from 'fs-extra'
import * as XLSX from 'xlsx'
import type { Product, ProductImage, ProductOption, ProductVariant } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

type MatrixifyRow = Record<string, string | number | boolean | undefined>

const str = (v: string | number | boolean | undefined): string =>
  v === undefined || v === null ? '' : String(v).trim()
const num = (v: string | number | boolean | undefined): number => {
  if (v === undefined || v === null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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

const rowToVariant = (row: MatrixifyRow, position: number): ProductVariant => {
  const optionValues = getOptionValues(row)
  const title = optionValues.map((o) => o.value).join(' / ') || 'Default Title'
  const weight = num(row['Variant Weight'])
  const weightUnit = str(row['Variant Weight Unit']) || 'kg'
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

const rowsToProduct = (rows: MatrixifyRow[]): Product => {
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
  const variants: ProductVariant[] = rows.map((row, i) => rowToVariant(row, i + 1))
  const options = buildOptionsFromVariants(variants)
  const images = collectImages(rows)
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
  }
}

const parseProductsSheet = (workbook: XLSX.WorkBook): Product[] => {
  const sheet = workbook.Sheets.Products ?? workbook.Sheets.Product
  if (!sheet) {
    throw new Error('XLSX has no "Products" or "Product" sheet')
  }
  const rows = XLSX.utils.sheet_to_json<MatrixifyRow>(sheet, { defval: '' })
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

  return groups.map((g) => rowsToProduct(g))
}

export const normalizeProductsFromXlsx = async (xlsxPath: string): Promise<Product[]> => {
  const workbook = XLSX.readFile(xlsxPath, { type: 'file' })
  const products = parseProductsSheet(workbook)
  logger.info(`Parsed ${products.length} products from Matrixify XLSX`)
  return products
}

export const exportProductsFromMatrixifyXlsx = async (xlsxPath?: string): Promise<void> => {
  const resolved = xlsxPath || config.SOURCE_XLSX_PATH || path.join(config.DATA_DIR, 'export.xlsx')
  const products = await normalizeProductsFromXlsx(resolved)
  const outPath = path.join(config.DATA_DIR, 'products.json')
  await outputJson(outPath, products, { spaces: 2 })
  logger.success(`Exported ${products.length} products → ${outPath}`)
}
