import { logger } from '#utils/logger'
import { resolveXlsxPath } from './manager'
import { exportCollectionsFromMatrixifyXlsx } from './collections'
import { exportProductsFromMatrixifyXlsx } from './products'

export { resolveXlsxPath } from './manager'

export const normalizeFromXlsx = async (options: {
  products?: boolean
  collections?: boolean
}): Promise<void> => {
  const xlsxPath = resolveXlsxPath()
  logger.info(`Normalizing from Matrixify XLSX: ${xlsxPath}`)
  if (options.products) await exportProductsFromMatrixifyXlsx(xlsxPath)
  if (options.collections) await exportCollectionsFromMatrixifyXlsx(xlsxPath)
}
