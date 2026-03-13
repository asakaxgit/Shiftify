import path from 'node:path'
import fs from 'fs-extra'
import { CollectionProductsDocument, ExportCollectionsDocument } from '#gql/graphql'
import type { Collection } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

const COLLECTION_PRODUCTS_PAGE_SIZE = 250

const fetchManualProductHandles = async (shop: string, collectionId: string): Promise<string[]> => {
  const handles: string[] = []
  let cursor: string | undefined

  do {
    const data = await shopifyClient.graphql(shop, CollectionProductsDocument, {
      id: collectionId,
      first: COLLECTION_PRODUCTS_PAGE_SIZE,
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

const COLLECTIONS_PAGE_SIZE = 250

export const exportCollections = async (options?: {
  dryRun?: boolean
  limit?: number
  query?: string | null
}): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  const limit = options?.limit
  const query = options?.query?.trim() || null
  logger.info(dryRun ? 'Exporting collections (dry-run)...' : 'Exporting collections...')
  const shop = config.SOURCE_SHOP
  const all: Collection[] = []
  let cursor: string | undefined

  // 1. Fetch all collection metadata
  do {
    const pageSize =
      limit != null ? Math.min(COLLECTIONS_PAGE_SIZE, limit - all.length) : COLLECTIONS_PAGE_SIZE
    if (pageSize <= 0) break
    const vars: { first: number; cursor?: string; query?: string } = {
      first: pageSize,
      ...(cursor ? { cursor } : {}),
      ...(query ? { query } : {}),
    }
    const data = await shopifyClient.graphql(shop, ExportCollectionsDocument, vars)
    const { nodes, pageInfo } = data.collections
    const toAdd =
      limit != null && all.length + nodes.length > limit
        ? nodes.slice(0, limit - all.length)
        : nodes
    all.push(...(toAdd as Collection[]))
    cursor =
      pageInfo.hasNextPage && pageInfo.endCursor && (limit == null || all.length < limit)
        ? pageInfo.endCursor
        : undefined
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
  if (dryRun) {
    logger.success(`Would write ${all.length} collections to ${outPath}`)
    return
  }
  await fs.outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} collections → ${outPath}`)
}
