import { importCollections } from '#adapters/shopify/collections/importer'
import { importMetafieldDefinitions } from '#adapters/shopify/metafieldDefinitions/importer'
import { importProducts } from '#adapters/shopify/products/importer'
import { logger } from '#utils/logger'
import { getCandidates, getSource } from './sourceManager'
import { parseEntities } from './parseEntities'

const main = async () => {
  const requested = parseEntities()
  const source = getSource()
  const candidates = await getCandidates(source)
  const entities = requested.filter((e) => candidates[e])
  const skipped = requested.filter((e) => !candidates[e])

  if (skipped.length) {
    logger.warn(`Skipped (not available from source): ${skipped.join(', ')}`)
  }
  if (entities.length === 0) {
    logger.warn('No entities to import; nothing to do')
    return
  }

  logger.info(`Importing: ${entities.join(', ')} (source: ${source})`)

  if (entities.includes('metafield-definitions')) await importMetafieldDefinitions()
  if (entities.includes('products')) await importProducts()
  if (entities.includes('collections')) await importCollections()

  logger.success('Import complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
