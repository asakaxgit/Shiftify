import path from 'node:path'
import fs from 'fs-extra'
import pLimit from 'p-limit'
import {
  FileContentType,
  ProductByIdentifierDocument,
  ProductSetDocument,
  type ProductSetInput,
  type WeightUnit,
} from '#gql/graphql'
import type { Product, ProductImage, ProductMetafield, ProductVariant } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

/** Normalize metafields from GraphQL shape (metafields.nodes) or direct array. */
const getMetafields = (owner: {
  metafields?: { nodes?: ProductMetafield[] } | ProductMetafield[]
}): ProductMetafield[] => {
  const raw = owner.metafields
  if (!raw) return []
  return Array.isArray(raw) ? raw : (raw.nodes ?? [])
}

/** Normalize product images from GraphQL shape (images.nodes). */
const getProductImages = (product: Product): ProductImage[] => {
  const raw = product.images?.nodes
  if (!raw?.length) return []
  return raw
}

const toMetafieldInput = (m: ProductMetafield) => ({
  namespace: m.namespace,
  key: m.key,
  type: m.type,
  value: m.value,
})

export const buildVariantInput = (variant: ProductVariant) => {
  const weight = variant.inventoryItem.measurement?.weight
  const metafields = getMetafields(variant)
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
    ...(metafields.length > 0 ? { metafields: metafields.map(toMetafieldInput) } : {}),
  }
}

const buildProductInput = (product: Product): ProductSetInput => {
  const productMetafields = getMetafields(product)
  const images = getProductImages(product).filter((img) => img.url?.trim())
  const files =
    images.length > 0
      ? images.map((img) => ({
          originalSource: img.url,
          ...(img.altText?.trim() ? { alt: img.altText } : {}),
          contentType: FileContentType.Image,
        }))
      : undefined
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
    ...(files ? { files } : {}),
    ...(productMetafields.length > 0
      ? { metafields: productMetafields.map(toMetafieldInput) }
      : {}),
  } as unknown as ProductSetInput
}

const isHandleAlreadyTaken = (message: string): boolean => {
  const m = message.toLowerCase()
  return (
    m.includes('handle') && (m.includes('taken') || m.includes('already') || m.includes('in use'))
  )
}

export const importProducts = async (options?: {
  dryRun?: boolean
  override?: boolean
}): Promise<void> => {
  const dryRun = options?.dryRun ?? false
  const override = options?.override ?? false
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
  const existingIdByHandle = new Map<string, string | null>()
  const limit = pLimit(config.CONCURRENCY)
  let done = 0
  let errors = 0

  const getExistingProductIdByHandle = async (handle: string): Promise<string | null> => {
    const cached = existingIdByHandle.get(handle)
    if (cached !== undefined) return cached
    const result = await shopifyClient.graphql(shop, ProductByIdentifierDocument, { handle })
    const existing = result.productByIdentifier?.id ?? null
    existingIdByHandle.set(handle, existing)
    return existing
  }

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
            const handle = product.handle.trim()
            if (
              override &&
              userErrors.some((e) => isHandleAlreadyTaken(e.message)) &&
              handle.length > 0
            ) {
              const existingId = await getExistingProductIdByHandle(handle)
              if (!existingId) {
                const msg = userErrors
                  .map((e) => `${(e.field ?? []).join('.')}: ${e.message}`)
                  .join('; ')
                logger.warn(
                  `  [skip] ${product.handle}: ${msg} (override: no existing product found)`,
                )
                errors++
                return
              }

              const retry = await shopifyClient.graphql(shop, ProductSetDocument, {
                input: { ...input, id: existingId },
              })
              const retrySet = retry.productSet
              if (!retrySet) return
              const { product: updated, userErrors: retryErrors } = retrySet
              if (retryErrors.length) {
                const msg = retryErrors
                  .map((e) => `${(e.field ?? []).join('.')}: ${e.message}`)
                  .join('; ')
                logger.warn(`  [skip] ${handle}: ${msg}`)
                errors++
                return
              }
              if (updated) {
                handleToId[updated.handle] = updated.id
              }
              return
            }

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
