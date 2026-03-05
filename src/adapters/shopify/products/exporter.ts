import path from 'node:path'
import fs from 'fs-extra'
import { ExportProductsDocument, type ExportProductsQuery } from '#gql/graphql'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

type ProductNode = ExportProductsQuery['products']['nodes'][number]

export const exportProducts = async (): Promise<void> => {
  logger.info('Exporting products...')
  const shop = config.SOURCE_SHOP
  const all: ProductNode[] = []
  let cursor: string | undefined

  do {
    const data = await shopifyClient.graphql(shop, ExportProductsDocument, cursor ? { cursor } : {})
    const { nodes, pageInfo } = data.products
    all.push(...nodes)
    cursor = pageInfo.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : undefined
    logger.info(`  fetched ${all.length} products so far`)
  } while (cursor)

  const outPath = path.join(config.DATA_DIR, 'products.json')
  await fs.outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} products → ${outPath}`)
}
