import path from 'node:path'
import fs from 'fs-extra'
import pLimit from 'p-limit'
import { ProductSetDocument, type ProductSetInput, type WeightUnit } from '#gql/graphql'
import type { Product, ProductVariant } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

export const buildVariantInput = (variant: ProductVariant) => {
  const weight = variant.inventoryItem.measurement?.weight
  return {
    sku: variant.sku ?? undefined,
    barcode: variant.barcode ?? undefined,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? undefined,
    inventoryPolicy: variant.inventoryPolicy,
    inventoryItem: {
      tracked: variant.inventoryItem.tracked,
      ...(weight
        ? { measurement: { weight: { value: weight.value, unit: weight.unit as WeightUnit } } }
        : {}),
    },
    optionValues: variant.selectedOptions.map((o) => ({ optionName: o.name, name: o.value })),
    position: variant.position,
  }
}

const buildProductInput = (product: Product): ProductSetInput => {
  return {
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml,
    productType: product.productType,
    vendor: product.vendor,
    status: product.status,
    tags: product.tags,
    productOptions: product.options.map((o) => ({
      name: o.name,
      values: o.values.map((v) => ({ name: v })),
    })),
    variants: product.variants.nodes.map((v) => buildVariantInput(v)),
  } as unknown as ProductSetInput
}

export const importProducts = async (options?: { dryRun?: boolean }): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  const shop = config.DEST_SHOP
  const dataPath = path.join(config.DATA_DIR, 'products.json')
  const products: Product[] = await fs.readJson(dataPath)
  logger.info(
    dryRun
      ? `Would import ${products.length} products to ${shop} (dry-run)...`
      : `Importing ${products.length} products to ${shop}...`,
  )

  if (dryRun) {
    const mapPath = path.join(config.MAPS_DIR, 'product-id-map.json')
    logger.success(`Would create ${products.length} products and write map to ${mapPath}`)
    return
  }

  const handleToId: Record<string, string> = {}
  const limit = pLimit(config.CONCURRENCY)
  let done = 0
  let errors = 0

  await Promise.all(
    products.map((product) =>
      limit(async () => {
        try {
          const input = buildProductInput(product)
          const result = await shopifyClient.graphql(shop, ProductSetDocument, { input })
          const set = result.productSet
          if (!set) return
          const { product: created, userErrors } = set

          if (userErrors.length) {
            const msg = userErrors
              .map((e) => `${(e.field ?? []).join('.')}: ${e.message}`)
              .join('; ')
            logger.warn(`  [skip] ${product.handle}: ${msg}`)
            errors++
            return
          }

          if (created) {
            handleToId[created.handle] = created.id
          }
        } catch (err) {
          logger.error(`  [error] ${product.handle}: ${String(err)}`)
          errors++
        } finally {
          done++
          if (done % 50 === 0 || done === products.length) {
            logger.info(`  ${done}/${products.length} products processed`)
          }
        }
      }),
    ),
  )

  const mapPath = path.join(config.MAPS_DIR, 'product-id-map.json')
  await fs.outputJson(mapPath, handleToId, { spaces: 2 })
  logger.success(
    `Imported ${Object.keys(handleToId).length}/${products.length} products (${errors} errors) → ${mapPath}`,
  )
}
