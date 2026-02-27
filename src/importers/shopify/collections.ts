import { pathExists, readJson } from 'fs-extra'
import path from 'node:path'
import type { Collection } from '../../types/shopify.js'
import { config } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import { shopifyClient } from '../../utils/shopifyClient.js'

const CREATE_MUTATION = /* GraphQL */ `
  mutation CollectionCreate($input: CollectionInput!) {
    collectionCreate(input: $input) {
      collection {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`

const ADD_PRODUCTS_MUTATION = /* GraphQL */ `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id }
      userErrors {
        field
        message
      }
    }
  }
`

type CreateResult = {
  collectionCreate: {
    collection: { id: string; handle: string } | null
    userErrors: Array<{ field: string[]; message: string }>
  }
}

type AddProductsResult = {
  collectionAddProducts: {
    collection: { id: string } | null
    userErrors: Array<{ field: string[]; message: string }>
  }
}

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

const addProducts = async (shop: string, collectionId: string, productIds: string[]): Promise<void> => {
  for (const batch of chunk(productIds, 250)) {
    const result = await shopifyClient.graphql<AddProductsResult>(shop, ADD_PRODUCTS_MUTATION, {
      id: collectionId,
      productIds: batch,
    })
    const { userErrors } = result.collectionAddProducts
    if (userErrors.length) {
      const msg = userErrors.map(e => `${e.field.join('.')}: ${e.message}`).join('; ')
      throw new Error(`collectionAddProducts error: ${msg}`)
    }
  }
}

export const importCollections = async (): Promise<void> => {
  const shop = config.DEV_SHOP
  const dataPath = path.join(config.DATA_DIR, 'collections.json')
  const mapPath = path.join(config.MAPS_DIR, 'product-id-map.json')

  const collections: Collection[] = await readJson(dataPath)
  logger.info(`Importing ${collections.length} collections to ${shop}...`)

  // Load handle→id map written by importProducts
  let handleToId: Record<string, string> = {}
  if (await pathExists(mapPath)) {
    handleToId = await readJson(mapPath)
  } else {
    logger.warn('product-id-map.json not found — manual collection membership will be skipped')
  }

  let done = 0
  let errors = 0

  for (const col of collections) {
    try {
      const input: Record<string, unknown> = {
        title: col.title,
        handle: col.handle,
        descriptionHtml: col.descriptionHtml,
        sortOrder: col.sortOrder,
        ...(col.templateSuffix ? { templateSuffix: col.templateSuffix } : {}),
        ...(col.image ? { image: { src: col.image.url, altText: col.image.altText ?? undefined } } : {}),
        ...(col.ruleSet ? { ruleSet: col.ruleSet } : {}),
      }

      const result = await shopifyClient.graphql<CreateResult>(shop, CREATE_MUTATION, { input })
      const { collection: created, userErrors } = result.collectionCreate

      if (userErrors.length) {
        const msg = userErrors.map(e => `${e.field.join('.')}: ${e.message}`).join('; ')
        logger.warn(`  [skip] ${col.handle}: ${msg}`)
        errors++
        continue
      }

      if (created && !col.ruleSet && col.productHandles?.length) {
        const productIds = col.productHandles.map(h => handleToId[h]).filter(Boolean)
        const missing = col.productHandles.length - productIds.length
        if (missing > 0) {
          logger.warn(`  [warn] ${col.handle}: ${missing} product handle(s) not in map, skipping them`)
        }
        if (productIds.length > 0) {
          await addProducts(shop, created.id, productIds)
        }
      }

      done++
      logger.info(`  [ok] ${col.handle}`)
    } catch (err) {
      logger.error(`  [error] ${col.handle}: ${String(err)}`)
      errors++
    }
  }

  logger.success(`Imported ${done}/${collections.length} collections (${errors} errors)`)
}
