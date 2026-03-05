import path from 'node:path'
import fs from 'fs-extra'
import * as XLSX from 'xlsx'
import type { Collection, CollectionRuleSet } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

type MatrixifyRow = Record<string, string | number | boolean | undefined>

const str = (v: string | number | boolean | undefined): string =>
  v === undefined || v === null ? '' : String(v).trim()

const parseSmartCollections = (workbook: XLSX.WorkBook): Collection[] => {
  const sheet = workbook.Sheets['Smart Collections'] ?? workbook.Sheets['Smart Collection']
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<MatrixifyRow>(sheet, { defval: '' })
  if (rows.length === 0) return []

  const collections: Collection[] = []
  let currentId = ''
  let currentHandle = ''
  const ruleRows: MatrixifyRow[] = []

  const flush = (first: MatrixifyRow) => {
    if (!currentHandle) return
    const mustMatch = str(first['Must Match']).toLowerCase()
    const appliedDisjunctively = mustMatch !== 'all'
    const rules = ruleRows
      .filter(
        (r) =>
          str(r['Rule: Product Column']) && str(r['Rule: Relation']) && str(r['Rule: Condition']),
      )
      .map((r) => ({
        column: str(r['Rule: Product Column']),
        relation: str(r['Rule: Relation']),
        condition: str(r['Rule: Condition']),
      }))
    const ruleSet: CollectionRuleSet | null =
      rules.length > 0 ? { appliedDisjunctively, rules } : null
    collections.push({
      id: currentId,
      title: str(first.Title) || currentHandle,
      handle: currentHandle,
      descriptionHtml: str(first['Body HTML']) || '',
      sortOrder: str(first['Sort Order']) || 'BEST_SELLING',
      templateSuffix: str(first['Template Suffix']) || null,
      image: str(first['Image Src'])
        ? { url: str(first['Image Src']), altText: str(first['Image Alt Text']) || null }
        : null,
      ruleSet,
    })
  }

  let firstRow: MatrixifyRow | null = null
  for (const row of rows) {
    const handle = str(row.Handle) || (firstRow ? str(firstRow.Handle) : '')
    const id = str(row.ID)
    if (handle && handle !== currentHandle && firstRow) {
      flush(firstRow)
      ruleRows.length = 0
      firstRow = null
    }
    if (handle) {
      currentHandle = handle
      currentId = id || currentId
      if (!firstRow) firstRow = row
      if (str(row['Rule: Product Column'])) ruleRows.push(row)
    }
  }
  if (firstRow) flush(firstRow)
  return collections
}

const parseCustomCollections = (workbook: XLSX.WorkBook): Collection[] => {
  const sheet = workbook.Sheets['Custom Collections'] ?? workbook.Sheets['Custom Collection']
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<MatrixifyRow>(sheet, { defval: '' })
  if (rows.length === 0) return []

  const byHandle = new Map<string, { first: MatrixifyRow; handles: string[] }>()
  let currentHandle = ''
  for (const row of rows) {
    const handle = str(row.Handle) || currentHandle
    if (handle) currentHandle = handle
    const productHandle = str(row['Product: Handle'])
    if (!handle) continue
    let entry = byHandle.get(handle)
    if (!entry) {
      entry = { first: row, handles: [] }
      byHandle.set(handle, entry)
    }
    if (productHandle) entry.handles.push(productHandle)
  }

  return Array.from(byHandle.entries()).map(([handle, { first, handles }]) => ({
    id: str(first.ID) || '',
    title: str(first.Title) || handle,
    handle,
    descriptionHtml: str(first['Body HTML']) || '',
    sortOrder: str(first['Sort Order']) || 'BEST_SELLING',
    templateSuffix: str(first['Template Suffix']) || null,
    image: str(first['Image Src'])
      ? { url: str(first['Image Src']), altText: str(first['Image Alt Text']) || null }
      : null,
    ruleSet: null,
    productHandles: handles,
  }))
}

export const normalizeCollectionsFromXlsx = (xlsxPath: string): Collection[] => {
  const buf = fs.readFileSync(xlsxPath)
  const workbook = XLSX.read(buf, { type: 'buffer' })
  const smart = parseSmartCollections(workbook)
  const custom = parseCustomCollections(workbook)
  return [...smart, ...custom]
}

export const exportCollectionsFromMatrixifyXlsx = async (xlsxPath: string): Promise<void> => {
  const collections = normalizeCollectionsFromXlsx(xlsxPath)
  logger.info(`Parsed ${collections.length} collections from Matrixify XLSX`)
  const outPath = path.join(config.DATA_DIR, 'collections.json')
  await fs.outputJson(outPath, collections, { spaces: 2 })
  logger.success(`Exported ${collections.length} collections → ${outPath}`)
}
