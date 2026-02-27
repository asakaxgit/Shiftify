import { outputJson } from 'fs-extra'
import path from 'node:path'
import type { Product } from '../../types/shopify.js'
import { config } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import { shopifyClient } from '../../utils/shopifyClient.js'

const QUERY = /* GraphQL */ `
  query ExportProducts($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        productType
        vendor
        status
        tags
        options {
          name
          values
        }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            barcode
            price
            compareAtPrice
            weight
            weightUnit
            inventoryPolicy
            inventoryItem { tracked }
            selectedOptions { name value }
            position
          }
        }
        images(first: 20) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`

type Page = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: Product[]
  }
}

export const exportProducts = async (): Promise<void> => {
  logger.info('Exporting products...')
  const shop = config.PROD_SHOP
  const all: Product[] = []
  let cursor: string | undefined

  do {
    const data = await shopifyClient.graphql<Page>(shop, QUERY, cursor ? { cursor } : {})
    const { nodes, pageInfo } = data.products
    all.push(...nodes)
    cursor = pageInfo.hasNextPage && pageInfo.endCursor ? pageInfo.endCursor : undefined
    logger.info(`  fetched ${all.length} products so far`)
  } while (cursor)

  const outPath = path.join(config.DATA_DIR, 'products.json')
  await outputJson(outPath, all, { spaces: 2 })
  logger.success(`Exported ${all.length} products → ${outPath}`)
}
