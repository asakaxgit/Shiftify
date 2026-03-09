import path from 'node:path'
import fs from 'fs-extra'
import { ExportProductsDocument, type ExportProductsQuery } from '#gql/graphql'
import { normalizeMetafieldValue } from '#utils/normalizeMetafieldValue'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

type ProductNode = ExportProductsQuery['products']['nodes'][number]

type MetafieldNode = { namespace: string; key: string; type: string; value: string }

const normalizeMetafieldNodes = (nodes: MetafieldNode[] | null | undefined): MetafieldNode[] => {
  if (!nodes?.length) return []
  return nodes.map((m) => ({ ...m, value: normalizeMetafieldValue(m.type, m.value) }))
}

const normalizeProductNode = (node: ProductNode): ProductNode => {
  const metafields =
    node.metafields?.nodes?.length ?
      { nodes: normalizeMetafieldNodes(node.metafields.nodes) }
    : node.metafields
  const variants =
    node.variants?.nodes?.length
      ? {
          nodes: node.variants.nodes.map((v) => ({
            ...v,
            metafields:
              v.metafields?.nodes?.length ?
                { nodes: normalizeMetafieldNodes(v.metafields.nodes) }
              : v.metafields,
          })),
        }
      : node.variants
  return { ...node, metafields, variants }
}

export const exportProducts = async (options?: { dryRun?: boolean }): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  logger.info(dryRun ? 'Exporting products (dry-run)...' : 'Exporting products...')
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
  if (dryRun) {
    logger.success(`Would write ${all.length} products to ${outPath}`)
    return
  }
  const normalized = all.map(normalizeProductNode)
  await fs.outputJson(outPath, normalized, { spaces: 2 })
  logger.success(`Exported ${normalized.length} products → ${outPath}`)
}
