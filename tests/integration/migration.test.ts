import { rm } from 'node:fs/promises'
import fs from 'fs-extra'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportCollections } from '#adapters/shopify/collections/exporter'
import { exportProducts } from '#adapters/shopify/products/exporter'
import { importCollections } from '#adapters/shopify/collections/importer'
import { importProducts } from '#adapters/shopify/products/importer'
import type { Collection, Product } from '#types/shopify'
import { config } from '#utils/config'
import {
  type CollectionSummary,
  type ProductSummary,
  queryCollections,
  queryProducts,
  seedCollections,
  seedProducts,
  truncateShop,
} from './helpers'

const PREFIX = `test-shiftify-${Date.now()}`
const SHOP = config.SOURCE_SHOP // same as DEST_SHOP for integration tests

// Shared state across tests (set in beforeAll)
let seededProducts: Array<{ id: string; handle: string }> = []
let snapshotBefore: ProductSummary[] = []
let exportedProducts: Product[] = []
let exportedCollections: Collection[] = []

describe('migration integrity', () => {
  beforeAll(async () => {
    // Step 1: truncate
    await truncateShop(SHOP)
    await rm(config.DATA_DIR, { recursive: true, force: true })
    await rm(config.MAPS_DIR, { recursive: true, force: true })

    // Step 2: seed
    seededProducts = await seedProducts(SHOP, PREFIX)
    await seedCollections(SHOP, PREFIX, seededProducts)

    // Snapshot seeded state for integrity comparison
    snapshotBefore = await queryProducts(SHOP, PREFIX)

    // Step 3: export
    await exportProducts()
    await exportCollections()

    exportedProducts = await fs.readJson(`${config.DATA_DIR}/products.json`)
    exportedCollections = await fs.readJson(`${config.DATA_DIR}/collections.json`)

    // Step 4: truncate again — remove seeded data
    await truncateShop(SHOP)

    // Step 5: import
    await importProducts()
    await importCollections()
  })

  // ── Export assertions ──────────────────────────────────────────────────────

  it('data/products.json contains all 3 seeded product handles', () => {
    const handles = exportedProducts.map((p) => p.handle)
    expect(handles).toContain(`${PREFIX}-tshirt`)
    expect(handles).toContain(`${PREFIX}-mug`)
    expect(handles).toContain(`${PREFIX}-hat`)
  })

  it('data/collections.json contains both seeded collections with productHandles for manual', () => {
    const handles = exportedCollections.map((c) => c.handle)
    expect(handles).toContain(`${PREFIX}-smart`)
    expect(handles).toContain(`${PREFIX}-manual`)

    const manual = exportedCollections.find((c) => c.handle === `${PREFIX}-manual`)
    expect(manual?.productHandles).toHaveLength(2)
    expect(manual?.productHandles).toContain(`${PREFIX}-tshirt`)
    expect(manual?.productHandles).toContain(`${PREFIX}-mug`)
  })

  // ── Import assertions ──────────────────────────────────────────────────────

  it('maps/product-id-map.json contains all 3 seeded handles', async () => {
    const map: Record<string, string> = await fs.readJson(`${config.MAPS_DIR}/product-id-map.json`)
    expect(Object.keys(map)).toContain(`${PREFIX}-tshirt`)
    expect(Object.keys(map)).toContain(`${PREFIX}-mug`)
    expect(Object.keys(map)).toContain(`${PREFIX}-hat`)
  })

  it('DEST_SHOP has both collections, smart ruleSet preserved, manual has 2 products', async () => {
    const cols: CollectionSummary[] = await queryCollections(SHOP, PREFIX)
    expect(cols).toHaveLength(2)

    const smart = cols.find((c) => c.handle === `${PREFIX}-smart`)
    expect(smart).toBeDefined()
    expect(smart?.ruleSet).toMatchObject({
      appliedDisjunctively: false,
      rules: [{ column: 'TYPE', relation: 'EQUALS', condition: 'T-Shirt' }],
    })

    const manual = cols.find((c) => c.handle === `${PREFIX}-manual`)
    expect(manual).toBeDefined()
    expect(manual?.productHandles).toHaveLength(2)
    expect(manual?.productHandles).toContain(`${PREFIX}-tshirt`)
    expect(manual?.productHandles).toContain(`${PREFIX}-mug`)
  })

  it('imported products match seeded data — titles, options, variant SKUs and selectedOptions', async () => {
    const imported: ProductSummary[] = await queryProducts(SHOP, PREFIX)
    expect(imported).toHaveLength(snapshotBefore.length)

    for (const src of snapshotBefore) {
      const dst = imported.find((p) => p.handle === src.handle)
      expect(dst, `missing handle ${src.handle}`).toBeDefined()
      if (!dst) continue

      expect(dst.title).toBe(src.title)
      expect(dst.variants).toHaveLength(src.variants.length)

      for (const sv of src.variants) {
        const dv = dst.variants.find((v) => v.sku === sv.sku)
        expect(dv, `missing variant sku ${sv.sku}`).toBeDefined()
        expect(dv?.selectedOptions).toEqual(sv.selectedOptions)
        expect(dv?.price).toBe(sv.price)
      }
    }
  })
})
