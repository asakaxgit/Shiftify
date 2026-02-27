import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product, ProductOption, ProductVariant } from '../../types/shopify'

vi.mock('../../utils/config.js', () => ({
  config: { DEV_SHOP: 'dev.myshopify.com', CONCURRENCY: 5, DATA_DIR: './data', MAPS_DIR: './maps' },
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))
vi.mock('p-limit', () => ({ default: () => (fn: () => unknown) => fn() }))

const graphql = vi.hoisted(() => vi.fn())
vi.mock('../../utils/shopifyClient.js', () => ({ shopifyClient: { graphql } }))

const readJson = vi.hoisted(() => vi.fn())
const outputJson = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({ readJson, outputJson }))

import { buildVariantInput, importProducts } from './products'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeVariant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 'gid://shopify/ProductVariant/1', title: 'Default Title',
  sku: null, barcode: null, price: '10.00', compareAtPrice: null,
  weight: 0, weightUnit: 'KILOGRAMS', inventoryPolicy: 'DENY',
  inventoryItem: { tracked: false },
  selectedOptions: [{ name: 'Title', value: 'Default Title' }],
  position: 1,
  ...overrides,
})

const product: Product = {
  id: 'gid://shopify/Product/1', title: 'Test', handle: 'test-product', descriptionHtml: '',
  productType: '', vendor: '', status: 'ACTIVE', tags: [],
  options: [{ name: 'Size', values: ['S'] }],
  variants: { nodes: [makeVariant({ selectedOptions: [{ name: 'Size', value: 'S' }] })] },
  images: { nodes: [] },
}

const createOk = (handle: string, id = 'gid://shopify/Product/99') => ({
  productCreate: { product: { id, handle }, userErrors: [] },
})
const createError = (message: string) => ({
  productCreate: { product: null, userErrors: [{ field: ['handle'], message }] },
})

// ─── buildVariantInput ───────────────────────────────────────────────────────

describe('buildVariantInput', () => {
  it('maps selectedOptions to values ordered by the product option list', () => {
    const options: ProductOption[] = [
      { name: 'Size', values: ['S', 'M', 'L'] },
      { name: 'Color', values: ['Red', 'Blue'] },
    ]
    const variant = makeVariant({
      selectedOptions: [{ name: 'Color', value: 'Blue' }, { name: 'Size', value: 'M' }],
    })
    expect(buildVariantInput(variant, options).options).toEqual(['M', 'Blue'])
  })

  it('sets inventoryManagement to SHOPIFY when tracked', () => {
    expect(buildVariantInput(makeVariant({ inventoryItem: { tracked: true } }), []).inventoryManagement).toBe('SHOPIFY')
  })

  it('sets inventoryManagement to NOT_MANAGED when untracked', () => {
    expect(buildVariantInput(makeVariant({ inventoryItem: { tracked: false } }), []).inventoryManagement).toBe('NOT_MANAGED')
  })

  it('converts null sku to undefined', () => {
    expect(buildVariantInput(makeVariant({ sku: null }), []).sku).toBeUndefined()
  })

  it('preserves a non-null sku', () => {
    expect(buildVariantInput(makeVariant({ sku: 'SKU-123' }), []).sku).toBe('SKU-123')
  })

  it('converts null compareAtPrice to undefined', () => {
    expect(buildVariantInput(makeVariant({ compareAtPrice: null }), []).compareAtPrice).toBeUndefined()
  })

  it('falls back to empty string for a missing option value', () => {
    const variant = makeVariant({ selectedOptions: [] })
    expect(buildVariantInput(variant, [{ name: 'Material', values: ['Cotton'] }]).options).toEqual([''])
  })
})

// ─── importProducts ───────────────────────────────────────────────────────────

describe('importProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a product and saves the handle→id map', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(createOk('test-product', 'gid://shopify/Product/99'))
    await importProducts()
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('product-id-map.json'),
      { 'test-product': 'gid://shopify/Product/99' },
      { spaces: 2 },
    )
  })

  it('calls productCreate with the correct shop', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(createOk('test-product'))
    await importProducts()
    expect(graphql).toHaveBeenCalledWith('dev.myshopify.com', expect.any(String), expect.any(Object))
  })

  it('skips a product on userErrors and excludes it from the map', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(createError('Handle already taken'))
    await importProducts()
    expect(Object.keys(outputJson.mock.calls[0][1])).toHaveLength(0)
  })

  it('catches a thrown graphql error and excludes the product from the map', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockRejectedValue(new Error('Network error'))
    await importProducts()
    expect(Object.keys(outputJson.mock.calls[0][1])).toHaveLength(0)
  })

  it('accumulates multiple products in the map', async () => {
    const productB: Product = { ...product, handle: 'product-b' }
    readJson.mockResolvedValue([product, productB])
    graphql
      .mockResolvedValueOnce(createOk('test-product', 'gid://shopify/Product/1'))
      .mockResolvedValueOnce(createOk('product-b', 'gid://shopify/Product/2'))
    await importProducts()
    expect(outputJson.mock.calls[0][1]).toEqual({
      'test-product': 'gid://shopify/Product/1',
      'product-b': 'gid://shopify/Product/2',
    })
  })
})
