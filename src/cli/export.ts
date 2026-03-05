import { normalizeFromXlsx } from '#adapters/matrixify'
import { exportCollections } from '#adapters/shopify/collections/exporter'
import { exportMetafieldDefinitions } from '#adapters/shopify/metafieldDefinitions/exporter'
import { exportProducts } from '#adapters/shopify/products/exporter'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { parseEntities } from './parseEntities'

const main = async () => {
  const entities = parseEntities()
  logger.info(`Exporting: ${entities.join(', ')} (source: ${config.SOURCE_TYPE})`)

  if (config.SOURCE_TYPE === 'matrixify-xlsx') {
    await normalizeFromXlsx({
      products: entities.includes('products'),
      collections: entities.includes('collections'),
    })
    if (entities.includes('metafield-definitions')) {
      logger.warn('metafield-definitions are not available from Matrixify XLSX; skipped')
    }
  } else {
    if (entities.includes('metafield-definitions')) await exportMetafieldDefinitions()
    if (entities.includes('products')) await exportProducts()
    if (entities.includes('collections')) await exportCollections()
  }

  logger.success('Export complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
