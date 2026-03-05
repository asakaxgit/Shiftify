import path from 'node:path'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { exportCollectionsFromMatrixifyXlsx } from './collections'
import { exportProductsFromMatrixifyXlsx } from './products'

export const resolveXlsxPath = (): string =>
  config.SOURCE_XLSX_PATH || path.join(config.DATA_DIR, 'export.xlsx')

export const normalizeFromXlsx = async (options: {
  products?: boolean
  collections?: boolean
}): Promise<void> => {
  const xlsxPath = resolveXlsxPath()
  logger.info(`Normalizing from Matrixify XLSX: ${xlsxPath}`)
  if (options.products) await exportProductsFromMatrixifyXlsx(xlsxPath)
  if (options.collections) await exportCollectionsFromMatrixifyXlsx(xlsxPath)
}
