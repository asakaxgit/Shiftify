import { importCollections } from '#adapters/shopify/collections/importer'
import { importMetafieldDefinitions } from '#adapters/shopify/metafieldDefinitions/importer'
import { importProducts } from '#adapters/shopify/products/importer'
import { logger } from '#utils/logger'
import { getDryRun, getOverride, parseEntities } from './parseEntities'
import { getCandidates, getSource } from './sourceManager'

const main = async () => {
  const requested = parseEntities()
  const dryRun = getDryRun()
  const override = getOverride()
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

  logger.info(`Importing: ${entities.join(', ')} (source: ${source})${dryRun ? ' [dry-run]' : ''}`)

  if (entities.includes('metafield-definitions')) await importMetafieldDefinitions({ dryRun })
  if (entities.includes('products')) await importProducts({ dryRun, override })
  if (entities.includes('collections')) await importCollections({ dryRun })

  logger.success(dryRun ? 'Import complete (dry-run)' : 'Import complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
