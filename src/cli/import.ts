import minimist from 'minimist'
import { importCollections } from '../importers/shopify/collections'
import { importProducts } from '../importers/shopify/products'
import { logger } from '../utils/logger'

type Entity = 'products' | 'collections'
const VALID_ENTITIES: readonly Entity[] = ['products', 'collections']
const VALID_SET = new Set<string>(VALID_ENTITIES)

function parseArgs(): Entity[] {
  const argv = minimist(process.argv.slice(2))
  const raw: string | string[] = argv.only ?? argv.o ?? []
  const requested = [raw].flat().filter(Boolean)
  if (!requested.length) return [...VALID_ENTITIES]
  const invalid = requested.filter(e => !VALID_SET.has(e))
  if (invalid.length) {
    logger.error(`Invalid --only: ${invalid.join(', ')}. Valid: ${VALID_ENTITIES.join(', ')}`)
    process.exit(1)
  }
  return requested.filter((e): e is Entity => VALID_SET.has(e))
}

async function main() {
  const entities = parseArgs()
  logger.info(`Importing: ${entities.join(', ')}`)

  if (entities.includes('products')) await importProducts()
  if (entities.includes('collections')) await importCollections()

  logger.success('Import complete')
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
