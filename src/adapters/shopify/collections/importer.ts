import path from 'node:path'
import fs from 'fs-extra'
import { CollectionAddProductsDocument, CollectionCreateDocument } from '#gql/graphql'
import type { Collection } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Normalize display enum (e.g. "Manual", "Vendor") to GraphQL enum (MANUAL, VENDOR). */
const toGraphQLEnum = (s: string): string => s.toUpperCase().replace(/\s+/g, '_')

/** Map API/display sortOrder variants to CollectionSortOrder enum. */
const SORT_ORDER_ALIASES: Record<string, string> = {
  CREATED_DESCENDING: 'CREATED_DESC',
  ALPHABET: 'ALPHA_ASC',
}
const toSortOrder = (s: string): string =>
  SORT_ORDER_ALIASES[toGraphQLEnum(s)] ?? toGraphQLEnum(s)

const addProducts = async (
  shop: string,
  collectionId: string,
  productIds: string[],
): Promise<void> => {
  for (const batch of chunk(productIds, 250)) {
    const result = await shopifyClient.graphql(shop, CollectionAddProductsDocument, {
      id: collectionId,
      productIds: batch,
    })
    const ap = result.collectionAddProducts
    if (!ap) continue
    const { userErrors } = ap
    if (userErrors.length) {
      const msg = userErrors
        .map(
          (e: { field?: string[] | null; message: string }) =>
            `${(e.field ?? []).join('.')}: ${e.message}`,
        )
        .join('; ')
      throw new Error(`collectionAddProducts error: ${msg}`)
    }
  }
}

export const importCollections = async (): Promise<void> => {
  const shop = config.DEST_SHOP
  const dataPath = path.join(config.DATA_DIR, 'collections.json')
  const mapPath = path.join(config.MAPS_DIR, 'product-id-map.json')

  const collections: Collection[] = await fs.readJson(dataPath)
  logger.info(`Importing ${collections.length} collections to ${shop}...`)

  // Load handle→id map written by importProducts
  let handleToId: Record<string, string> = {}
  if (await fs.pathExists(mapPath)) {
    handleToId = await fs.readJson(mapPath)
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
        sortOrder: toSortOrder(col.sortOrder),
        ...(col.templateSuffix ? { templateSuffix: col.templateSuffix } : {}),
        ...(col.image
          ? { image: { src: col.image.url, altText: col.image.altText ?? undefined } }
          : {}),
        ...(col.ruleSet
          ? {
              ruleSet: {
                appliedDisjunctively: col.ruleSet.appliedDisjunctively,
                rules: col.ruleSet.rules.map((r) => ({
                  column: toGraphQLEnum(r.column),
                  relation: toGraphQLEnum(r.relation),
                  condition: r.condition,
                })),
              },
            }
          : {}),
      }

      const result = await shopifyClient.graphql(shop, CollectionCreateDocument, { input })
      const cc = result.collectionCreate
      if (!cc) continue
      const { collection: created, userErrors } = cc

      if (userErrors.length) {
        const msg = userErrors
          .map(
            (e: { field?: string[] | null; message: string }) =>
              `${(e.field ?? []).join('.')}: ${e.message}`,
          )
          .join('; ')
        logger.warn(`  [skip] ${col.handle}: ${msg}`)
        errors++
        continue
      }

      if (created && !col.ruleSet && col.productHandles?.length) {
        const productIds = col.productHandles.map((h) => handleToId[h]).filter(Boolean)
        const missing = col.productHandles.length - productIds.length
        if (missing > 0) {
          logger.warn(
            `  [warn] ${col.handle}: ${missing} product handle(s) not in map, skipping them`,
          )
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
