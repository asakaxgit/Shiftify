import { importCollections } from '../shopify/collections/importer'
import { importMetafieldDefinitions } from '../shopify/metafieldDefinitions/importer'
import { importProducts } from '../shopify/products/importer'
import { logger } from '../utils/logger'
import { parseEntities } from './parseEntities'

const main = async () => {
  const entities = parseEntities()
  logger.info(`Importing: ${entities.join(', ')}`)

  if (entities.includes('metafield-definitions')) await importMetafieldDefinitions()
  if (entities.includes('products')) await importProducts()
  if (entities.includes('collections')) await importCollections()

  logger.success('Import complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
