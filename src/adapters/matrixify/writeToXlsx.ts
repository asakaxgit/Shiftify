import { appendSheet, createWorkbook, writeWorkbook } from '#adapters/xlsx'
import type { Collection } from '#types/shopify'
import type { Product } from '#types/shopify'
import { collectionsToRows } from './collectionsToXlsx'
import { productsToRows } from './productsToXlsx'

export type ExportToXlsxEntity = 'products' | 'collections'

export const writeToXlsx = async (
  outputPath: string,
  options: {
    products?: Product[]
    collections?: Collection[]
    only?: ExportToXlsxEntity[]
    dryRun?: boolean
  },
): Promise<void> => {
  const { products = [], collections = [], only, dryRun = false } = options
  const includeProducts = !only || only.includes('products')
  const includeCollections = !only || only.includes('collections')

  if (dryRun) return

  const workbook = createWorkbook()

  if (includeProducts) {
    const productRows = productsToRows(products)
    appendSheet(workbook, 'Products', productRows as Record<string, unknown>[])
  }
  if (includeCollections) {
    const { smart, custom } = collectionsToRows(collections)
    appendSheet(workbook, 'Smart Collections', smart as Record<string, unknown>[])
    appendSheet(workbook, 'Custom Collections', custom as Record<string, unknown>[])
  }

  await writeWorkbook(workbook, outputPath)
}
