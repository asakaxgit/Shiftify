import { importCollections } from '../importers/shopify/collections'
import { importProducts } from '../importers/shopify/products'
import { logger } from '../utils/logger'
import { parseEntities } from './parseEntities'

const main = async () => {
  const entities = parseEntities()
  logger.info(`Importing: ${entities.join(', ')}`)

  if (entities.includes('products')) await importProducts()
  if (entities.includes('collections')) await importCollections()

  logger.success('Import complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
