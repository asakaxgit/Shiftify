import { exportCollections } from '../exporters/shopify/collections'
import { exportProducts } from '../exporters/shopify/products'
import { logger } from '../utils/logger'
import { parseEntities } from './parseEntities'

const main = async () => {
  const entities = parseEntities()
  logger.info(`Exporting: ${entities.join(', ')}`)

  if (entities.includes('products')) await exportProducts()
  if (entities.includes('collections')) await exportCollections()

  logger.success('Export complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
