import { outputJson, readJson } from 'fs-extra'
import pLimit from 'p-limit'
import path from 'node:path'
import type { Product, ProductOption, ProductVariant } from '../../types/shopify.js'
import { config } from '../../utils/config.js'
import { logger } from '../../utils/logger.js'
import { shopifyClient } from '../../utils/shopifyClient.js'

const CREATE_MUTATION = /* GraphQL */ `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
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

interface CreateResult {
  productCreate: {
    product: { id: string; handle: string } | null
    userErrors: Array<{ field: string[]; message: string }>
  }
}

function buildVariantInput(variant: ProductVariant, productOptions: ProductOption[]) {
  // Map selectedOptions to ordered values matching the product's option list
  const options = productOptions.map(opt => {
    const match = variant.selectedOptions.find(s => s.name === opt.name)
    return match?.value ?? ''
  })
  return {
    sku: variant.sku ?? undefined,
    barcode: variant.barcode ?? undefined,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? undefined,
    weight: variant.weight,
    weightUnit: variant.weightUnit,
    inventoryPolicy: variant.inventoryPolicy,
    inventoryManagement: variant.inventoryItem.tracked ? 'SHOPIFY' : 'NOT_MANAGED',
    options,
    position: variant.position,
  }
}

function buildProductInput(product: Product) {
  return {
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml,
    productType: product.productType,
    vendor: product.vendor,
    status: product.status,
    tags: product.tags,
    options: product.options.map(o => o.name),
    variants: product.variants.nodes.map(v => buildVariantInput(v, product.options)),
    images: product.images.nodes.map(img => ({
      src: img.url,
      altText: img.altText ?? undefined,
    })),
  }
}

export async function importProducts(): Promise<void> {
  const shop = config.DEV_SHOP
  const dataPath = path.join(config.DATA_DIR, 'products.json')
  const products: Product[] = await readJson(dataPath)
  logger.info(`Importing ${products.length} products to ${shop}...`)

  const handleToId: Record<string, string> = {}
  const limit = pLimit(config.CONCURRENCY)
  let done = 0
  let errors = 0

  await Promise.all(
    products.map(product =>
      limit(async () => {
        try {
          const input = buildProductInput(product)
          const result = await shopifyClient.graphql<CreateResult>(shop, CREATE_MUTATION, { input })
          const { product: created, userErrors } = result.productCreate

          if (userErrors.length) {
            const msg = userErrors.map(e => `${e.field.join('.')}: ${e.message}`).join('; ')
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
  await outputJson(mapPath, handleToId, { spaces: 2 })
  logger.success(
    `Imported ${Object.keys(handleToId).length}/${products.length} products (${errors} errors) → ${mapPath}`,
  )
}
