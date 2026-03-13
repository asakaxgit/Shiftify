import path from 'node:path'
import fs from 'fs-extra'
import { ExportMetafieldDefinitionsDocument, MetafieldOwnerType } from '#gql/graphql'
import type { MetafieldDefinition } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

const OWNER_TYPES = [
  MetafieldOwnerType.Product,
  MetafieldOwnerType.Productvariant,
  MetafieldOwnerType.Collection,
  MetafieldOwnerType.Customer,
  MetafieldOwnerType.Order,
  MetafieldOwnerType.Page,
  MetafieldOwnerType.Blog,
  MetafieldOwnerType.Article,
  MetafieldOwnerType.Location,
  MetafieldOwnerType.Shop,
] as const

const METAFIELD_DEFINITIONS_PAGE_SIZE = 250

export const exportMetafieldDefinitions = async (options?: {
  dryRun?: boolean
  limit?: number
}): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  const limit = options?.limit
  logger.info(
    dryRun ? 'Exporting metafield definitions (dry-run)...' : 'Exporting metafield definitions...',
  )
  const shop = config.SOURCE_SHOP
  const all: MetafieldDefinition[] = []

  outer: for (const ownerType of OWNER_TYPES) {
    let cursor: string | undefined
    do {
      const pageSize =
        limit != null
          ? Math.min(METAFIELD_DEFINITIONS_PAGE_SIZE, limit - all.length)
          : METAFIELD_DEFINITIONS_PAGE_SIZE
      if (pageSize <= 0) break outer
      const vars = {
        ownerType,
        first: pageSize,
        ...(cursor ? { cursor } : {}),
      }
      const data = await shopifyClient.graphql(shop, ExportMetafieldDefinitionsDocument, vars)
      const { nodes, pageInfo } = data.metafieldDefinitions
      const mapped = nodes.map((n) => ({
        name: n.name,
        namespace: n.namespace,
        key: n.key,
        description: n.description ?? null,
        type: n.type.name,
        ownerType: n.ownerType,
        pinnedPosition: null,
        validations: [],
      }))
      const toAdd =
        limit != null && all.length + mapped.length > limit
          ? mapped.slice(0, limit - all.length)
          : mapped
      all.push(...toAdd)
      cursor =
        pageInfo.hasNextPage && pageInfo.endCursor && (limit == null || all.length < limit)
          ? pageInfo.endCursor
          : undefined
    } while (cursor)
  }

  const outPath = path.join(config.DATA_DIR, 'metafield-definitions.json')
  if (dryRun) {
    logger.success(`Would write ${all.length} metafield definitions to ${outPath}`)
    return
  }
  await fs.outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} metafield definitions → ${outPath}`)
}
