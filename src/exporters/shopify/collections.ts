import path from 'node:path'
import { outputJson } from 'fs-extra'
import { CollectionProductsDocument, ExportCollectionsDocument } from '../../gql/graphql'
import type { Collection } from '../../types/shopify'
import { config } from '../../utils/config'
import { logger } from '../../utils/logger'
import { shopifyClient } from '../../utils/shopifyClient'

const fetchManualProductHandles = async (shop: string, collectionId: string): Promise<string[]> => {
  const handles: string[] = []
  let cursor: string | undefined

  do {
    const data = await shopifyClient.graphql(shop, CollectionProductsDocument, {
      id: collectionId,
      ...(cursor ? { cursor } : {}),
    })
    const conn = data.collection?.products
    if (!conn) break
    handles.push(...conn.nodes.map((n) => n.handle))
    cursor =
      conn.pageInfo.hasNextPage && conn.pageInfo.endCursor ? conn.pageInfo.endCursor : undefined
  } while (cursor)

  return handles
}

export const exportCollections = async (): Promise<void> => {
  logger.info('Exporting collections...')
  const shop = config.PROD_SHOP
  const all: Collection[] = []
  let cursor: string | undefined

  // 1. Fetch all collection metadata
  do {
    const data = await shopifyClient.graphql(
      shop,
      ExportCollectionsDocument,
      cursor ? { cursor } : {},
    )
    const { nodes, pageInfo } = data.collections
    all.push(...(nodes as Collection[]))
    cursor = pageInfo.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : undefined
    logger.info(`  fetched ${all.length} collections so far`)
  } while (cursor)

  // 2. For manual collections, fetch product membership by handle
  const manual = all.filter((c) => c.ruleSet === null)
  if (manual.length) {
    logger.info(`  fetching product handles for ${manual.length} manual collections...`)
    for (const col of manual) {
      col.productHandles = await fetchManualProductHandles(shop, col.id)
      logger.info(`    ${col.handle}: ${col.productHandles.length} products`)
    }
  }

  const outPath = path.join(config.DATA_DIR, 'collections.json')
  await outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} collections → ${outPath}`)
}
