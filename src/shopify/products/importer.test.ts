import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product, ProductVariant } from '../../types/shopify'

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

import { buildVariantInput, importProducts } from './importer'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeVariant = (overrides: Partial<ProductVariant> = {}): ProductVariant => ({
  id: 'gid://shopify/ProductVariant/1',
  title: 'Default Title',
  sku: null,
  barcode: null,
  price: '10.00',
  compareAtPrice: null,
  inventoryPolicy: 'DENY',
  inventoryItem: { tracked: false, measurement: { weight: null } },
  selectedOptions: [{ name: 'Title', value: 'Default Title' }],
  position: 1,
  ...overrides,
})

const product: Product = {
  id: 'gid://shopify/Product/1',
  title: 'Test',
  handle: 'test-product',
  descriptionHtml: '',
  productType: '',
  vendor: '',
  status: 'ACTIVE',
  tags: [],
  options: [{ name: 'Size', values: ['S'] }],
  variants: { nodes: [makeVariant({ selectedOptions: [{ name: 'Size', value: 'S' }] })] },
  images: { nodes: [] },
}

const setOk = (handle: string, id = 'gid://shopify/Product/99') => ({
  productSet: { product: { id, handle }, userErrors: [] },
})
const setError = (message: string) => ({
  productSet: { product: null, userErrors: [{ field: ['handle'], message }] },
})

// ─── buildVariantInput ───────────────────────────────────────────────────────

describe('buildVariantInput', () => {
  it('maps selectedOptions to optionValues by name', () => {
    const variant = makeVariant({
      selectedOptions: [
        { name: 'Color', value: 'Blue' },
        { name: 'Size', value: 'M' },
      ],
    })
    expect(buildVariantInput(variant).optionValues).toEqual([
      { optionName: 'Color', name: 'Blue' },
      { optionName: 'Size', name: 'M' },
    ])
  })

  it('sets inventoryItem.tracked to true when tracked', () => {
    expect(
      buildVariantInput(
        makeVariant({ inventoryItem: { tracked: true, measurement: { weight: null } } }),
      ).inventoryItem.tracked,
    ).toBe(true)
  })

  it('sets inventoryItem.tracked to false when untracked', () => {
    expect(buildVariantInput(makeVariant()).inventoryItem.tracked).toBe(false)
  })

  it('converts null sku to undefined', () => {
    expect(buildVariantInput(makeVariant({ sku: null })).sku).toBeUndefined()
  })

  it('preserves a non-null sku', () => {
    expect(buildVariantInput(makeVariant({ sku: 'SKU-123' })).sku).toBe('SKU-123')
  })

  it('converts null compareAtPrice to undefined', () => {
    expect(buildVariantInput(makeVariant({ compareAtPrice: null })).compareAtPrice).toBeUndefined()
  })

  it('includes weight measurement when present', () => {
    const variant = makeVariant({
      inventoryItem: { tracked: false, measurement: { weight: { unit: 'KILOGRAMS', value: 1.5 } } },
    })
    expect(buildVariantInput(variant).inventoryItem.measurement).toEqual({
      weight: { value: 1.5, unit: 'KILOGRAMS' },
    })
  })
})

// ─── importProducts ───────────────────────────────────────────────────────────

describe('importProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a product and saves the handle→id map', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(setOk('test-product', 'gid://shopify/Product/99'))
    await importProducts()
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('product-id-map.json'),
      { 'test-product': 'gid://shopify/Product/99' },
      { spaces: 2 },
    )
  })

  it('calls productSet with the correct shop', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(setOk('test-product'))
    await importProducts()
    expect(graphql).toHaveBeenCalledWith(
      'dev.myshopify.com',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('skips a product on userErrors and excludes it from the map', async () => {
    readJson.mockResolvedValue([product])
    graphql.mockResolvedValue(setError('Handle already taken'))
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
      .mockResolvedValueOnce(setOk('test-product', 'gid://shopify/Product/1'))
      .mockResolvedValueOnce(setOk('product-b', 'gid://shopify/Product/2'))
    await importProducts()
    expect(outputJson.mock.calls[0][1]).toEqual({
      'test-product': 'gid://shopify/Product/1',
      'product-b': 'gid://shopify/Product/2',
    })
  })
})
