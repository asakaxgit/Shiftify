import { logger } from '#utils/logger'
import { exportCollectionsFromMatrixifyXlsx } from './collections'
import { resolveXlsxPath } from './manager'
import { exportMetafieldDefinitionsFromMatrixifyXlsx } from './metafieldDefinitions'
import { exportProductsFromMatrixifyXlsx } from './products'

export { resolveXlsxPath } from './manager'

export const normalizeFromXlsx = async (options: {
  products?: boolean
  collections?: boolean
  metafieldDefinitions?: boolean
}): Promise<void> => {
  const xlsxPath = resolveXlsxPath()
  logger.info(`Normalizing from Matrixify XLSX: ${xlsxPath}`)
  if (options.products) await exportProductsFromMatrixifyXlsx(xlsxPath)
  if (options.collections) await exportCollectionsFromMatrixifyXlsx(xlsxPath)
  if (options.metafieldDefinitions) await exportMetafieldDefinitionsFromMatrixifyXlsx(xlsxPath)
}
