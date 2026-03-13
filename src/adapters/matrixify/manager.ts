import path from 'node:path'
import { hasSheet, readWorkbook } from '#adapters/xlsx'
import type { Entity } from '#cli/parseEntities'
import { config } from '#utils/config'
import { logger } from '#utils/logger'

const ENTITIES: readonly Entity[] = ['products', 'collections', 'metafield-definitions']

export const resolveXlsxPath = (): string =>
  config.SOURCE_XLSX_PATH || path.resolve(config.DATA_DIR, 'export.xlsx')

/**
 * Returns which entities can be imported/exported from this source.
 * For Matrixify, candidates are determined by which sheets exist in the XLSX.
 */
export const getCandidates = async (): Promise<Record<Entity, boolean>> => {
  const xlsxPath = resolveXlsxPath()
  const workbook = await readWorkbook(xlsxPath)

  const products = hasSheet(workbook, ['Products', 'Product'])
  const collections = hasSheet(workbook, [
    'Smart Collections',
    'Smart Collection',
    'Custom Collections',
    'Custom Collection',
  ])
  const metafieldDefinitions = hasSheet(workbook, ['Products', 'Product'])

  const candidates: Record<Entity, boolean> = {
    products,
    collections,
    'metafield-definitions': metafieldDefinitions,
  }

  const available = ENTITIES.filter((e) => candidates[e])
  if (available.length === 0) {
    logger.warn(
      `Matrixify XLSX has no known sheets (Products, Smart/Custom Collections); path: ${xlsxPath}`,
    )
  }

  return candidates
}
