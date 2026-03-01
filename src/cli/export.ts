import { exportCollections } from '../shopify/collections/exporter'
import { exportMetafieldDefinitions } from '../shopify/metafieldDefinitions/exporter'
import { exportProducts } from '../shopify/products/exporter'
import { logger } from '../utils/logger'
import { parseEntities } from './parseEntities'

const main = async () => {
  const entities = parseEntities()
  logger.info(`Exporting: ${entities.join(', ')}`)

  if (entities.includes('metafield-definitions')) await exportMetafieldDefinitions()
  if (entities.includes('products')) await exportProducts()
  if (entities.includes('collections')) await exportCollections()

  logger.success('Export complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
