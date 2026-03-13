import path from 'node:path'
import fs from 'fs-extra'
import { ExportProductsDocument, type ExportProductsQuery } from '#gql/graphql'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { normalizeMetafieldValue } from '#utils/normalizeMetafieldValue'
import { shopifyClient } from '#utils/shopifyClient'

type ProductNode = ExportProductsQuery['products']['nodes'][number]

type MetafieldNode = { namespace: string; key: string; type: string; value: string }

const normalizeMetafieldNodes = (nodes: MetafieldNode[] | null | undefined): MetafieldNode[] => {
  if (!nodes?.length) return []
  return nodes.map((m) => ({ ...m, value: normalizeMetafieldValue(m.type, m.value) }))
}

const normalizeProductNode = (node: ProductNode): ProductNode => {
  const metafields = node.metafields?.nodes?.length
    ? { nodes: normalizeMetafieldNodes(node.metafields.nodes) }
    : node.metafields
  const variants = node.variants?.nodes?.length
    ? {
        nodes: node.variants.nodes.map((v) => ({
          ...v,
          metafields: v.metafields?.nodes?.length
            ? { nodes: normalizeMetafieldNodes(v.metafields.nodes) }
            : v.metafields,
        })),
      }
    : node.variants
  return { ...node, metafields, variants }
}

const PRODUCTS_PAGE_SIZE = 100

export const exportProducts = async (options?: {
  dryRun?: boolean
  limit?: number
  query?: string | null
}): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  const limit = options?.limit
  const query = options?.query?.trim() || null
  logger.info(dryRun ? 'Exporting products (dry-run)...' : 'Exporting products...')
  const shop = config.SOURCE_SHOP
  const all: ProductNode[] = []
  let cursor: string | undefined

  do {
    const pageSize =
      limit != null ? Math.min(PRODUCTS_PAGE_SIZE, limit - all.length) : PRODUCTS_PAGE_SIZE
    if (pageSize <= 0) break
    const vars: { first: number; cursor?: string; query?: string } = {
      first: pageSize,
      ...(cursor ? { cursor } : {}),
      ...(query ? { query } : {}),
    }
    const data = await shopifyClient.graphql(shop, ExportProductsDocument, vars)
    const { nodes, pageInfo } = data.products
    const toAdd =
      limit != null && all.length + nodes.length > limit
        ? nodes.slice(0, limit - all.length)
        : nodes
    all.push(...toAdd)
    cursor =
      pageInfo.hasNextPage && pageInfo.endCursor && (limit == null || all.length < limit)
        ? pageInfo.endCursor
        : undefined
    logger.info(`  fetched ${all.length} products so far`)
  } while (cursor)

  const outPath = path.join(config.DATA_DIR, 'products.json')
  if (dryRun) {
    logger.success(`Would write ${all.length} products to ${outPath}`)
    return
  }
  const normalized = all.map(normalizeProductNode)
  await fs.outputJson(outPath, normalized, { spaces: 2 })
  logger.success(`Exported ${normalized.length} products → ${outPath}`)
}
