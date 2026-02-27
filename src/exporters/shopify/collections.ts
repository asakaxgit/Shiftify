import { outputJson } from 'fs-extra'
import path from 'node:path'
import type { Collection } from '../../types/shopify.js'
import { config } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import { shopifyClient } from '../../utils/shopifyClient.js'

const COLLECTIONS_QUERY = /* GraphQL */ `
  query ExportCollections($cursor: String) {
    collections(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        sortOrder
        templateSuffix
        image { url altText }
        ruleSet {
          appliedDisjunctively
          rules { column relation condition }
        }
      }
    }
  }
`

const MANUAL_PRODUCTS_QUERY = /* GraphQL */ `
  query CollectionProducts($id: ID!, $cursor: String) {
    collection(id: $id) {
      products(first: 250, after: $cursor) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          handle
        }
      }
    }
  }
`

type CollectionsPage = {
  collections: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: Collection[]
  }
}

type ManualProductsPage = {
  collection: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: Array<{ handle: string }>
    }
  } | null
}

const fetchManualProductHandles = async (shop: string, collectionId: string): Promise<string[]> => {
  const handles: string[] = []
  let cursor: string | undefined

  do {
    const data = await shopifyClient.graphql<ManualProductsPage>(
      shop,
      MANUAL_PRODUCTS_QUERY,
      { id: collectionId, ...(cursor ? { cursor } : {}) },
    )
    const conn = data.collection?.products
    if (!conn) break
    handles.push(...conn.nodes.map(n => n.handle))
    cursor = conn.pageInfo.hasNextPage && conn.pageInfo.endCursor ? conn.pageInfo.endCursor : undefined
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
    const data = await shopifyClient.graphql<CollectionsPage>(
      shop,
      COLLECTIONS_QUERY,
      cursor ? { cursor } : {},
    )
    const { nodes, pageInfo } = data.collections
    all.push(...nodes)
    cursor = pageInfo.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : undefined
    logger.info(`  fetched ${all.length} collections so far`)
  } while (cursor)

  // 2. For manual collections, fetch product membership by handle
  const manual = all.filter(c => c.ruleSet === null)
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
