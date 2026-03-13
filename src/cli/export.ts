import { normalizeFromXlsx } from '#adapters/matrixify'
import { exportCollections } from '#adapters/shopify/collections/exporter'
import { exportMetafieldDefinitions } from '#adapters/shopify/metafieldDefinitions/exporter'
import { exportProducts } from '#adapters/shopify/products/exporter'
import { logger } from '#utils/logger'
import { getDryRun, getExportLimit, getExportQuery, parseEntities } from './parseEntities'
import { getCandidates, getSource } from './sourceManager'

const main = async () => {
  const requested = parseEntities()
  const dryRun = getDryRun()
  const limit = getExportLimit()
  const query = getExportQuery()
  const source = getSource()
  const candidates = await getCandidates(source)
  const entities = requested.filter((e) => candidates[e])
  const skipped = requested.filter((e) => !candidates[e])

  if (skipped.length) {
    logger.warn(`Skipped (not available from source): ${skipped.join(', ')}`)
  }
  if (entities.length === 0) {
    logger.warn('No entities to export; nothing to do')
    return
  }

  logger.info(`Exporting: ${entities.join(', ')} (source: ${source})${dryRun ? ' [dry-run]' : ''}`)

  if (source === 'matrixify-xlsx') {
    await normalizeFromXlsx({
      products: entities.includes('products'),
      collections: entities.includes('collections'),
      metafieldDefinitions: entities.includes('metafield-definitions'),
      dryRun,
    })
  } else {
    const exportOptions = { dryRun, limit: limit ?? undefined, query: query ?? undefined }
    if (entities.includes('metafield-definitions')) await exportMetafieldDefinitions(exportOptions)
    if (entities.includes('products')) await exportProducts(exportOptions)
    if (entities.includes('collections')) await exportCollections(exportOptions)
  }

  logger.success(dryRun ? 'Export complete (dry-run)' : 'Export complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
