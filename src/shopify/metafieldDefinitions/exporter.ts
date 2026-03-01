import path from 'node:path'
import { outputJson } from 'fs-extra'
import { ExportMetafieldDefinitionsDocument, MetafieldOwnerType } from '../../gql/graphql'
import type { MetafieldDefinition } from '../../types/shopify'
import { config } from '../../utils/config'
import { logger } from '../../utils/logger'
import { shopifyClient } from '../../utils/shopifyClient'

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

export const exportMetafieldDefinitions = async (): Promise<void> => {
  logger.info('Exporting metafield definitions...')
  const shop = config.PROD_SHOP
  const all: MetafieldDefinition[] = []

  for (const ownerType of OWNER_TYPES) {
    let cursor: string | undefined
    do {
      const data = await shopifyClient.graphql(
        shop,
        ExportMetafieldDefinitionsDocument,
        cursor ? { ownerType, cursor } : { ownerType },
      )
      const { nodes, pageInfo } = data.metafieldDefinitions
      all.push(
        ...nodes.map((n) => ({
          name: n.name,
          namespace: n.namespace,
          key: n.key,
          description: n.description ?? null,
          type: n.type.name,
          ownerType: n.ownerType,
          pinnedPosition: n.pinnedPosition ?? null,
          validations: n.validations.map((v) => ({
            name: v.name,
            type: v.type,
            value: v.value ?? null,
          })),
        })),
      )
      cursor = pageInfo.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : undefined
    } while (cursor)
  }

  const outPath = path.join(config.DATA_DIR, 'metafield-definitions.json')
  await outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} metafield definitions → ${outPath}`)
}
