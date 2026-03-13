import { logger } from '#utils/logger'
import { exportCollectionsFromMatrixifyXlsx } from './collections'
import { resolveXlsxPath } from './manager'
import { exportMetafieldDefinitionsFromMatrixifyXlsx } from './metafieldDefinitions'
import { exportProductsFromMatrixifyXlsx } from './products'

export { collectionsToRows } from './collectionsToXlsx'
export { productsToRows } from './productsToXlsx'
export { resolveXlsxPath } from './manager'
export { type ExportToXlsxEntity, writeToXlsx } from './writeToXlsx'

export const normalizeFromXlsx = async (options: {
  products?: boolean
  collections?: boolean
  metafieldDefinitions?: boolean
  dryRun?: boolean
}): Promise<void> => {
  const xlsxPath = resolveXlsxPath()
  logger.info(`Normalizing from Matrixify XLSX: ${xlsxPath}${options.dryRun ? ' (dry-run)' : ''}`)
  if (options.products) await exportProductsFromMatrixifyXlsx(xlsxPath, { dryRun: options.dryRun })
  if (options.collections)
    await exportCollectionsFromMatrixifyXlsx(xlsxPath, { dryRun: options.dryRun })
  if (options.metafieldDefinitions)
    await exportMetafieldDefinitionsFromMatrixifyXlsx(xlsxPath, { dryRun: options.dryRun })
}
