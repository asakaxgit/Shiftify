import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Product } from '#types/shopify'

vi.mock('#utils/config', () => ({
  config: { SOURCE_SHOP: 'prod.myshopify.com', DATA_DIR: './data' },
}))
vi.mock('#utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const graphql = vi.hoisted(() => vi.fn())
vi.mock('#utils/shopifyClient', () => ({ shopifyClient: { graphql } }))

const outputJson = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({ outputJson }))

import { exportProducts } from './exporter'

const productA: Product = {
  id: 'gid://shopify/Product/1',
  title: 'A',
  handle: 'product-a',
  descriptionHtml: '',
  productType: '',
  vendor: '',
  status: 'ACTIVE',
  tags: [],
  options: [],
  variants: { nodes: [] },
  images: { nodes: [] },
}
const productB: Product = { ...productA, id: 'gid://shopify/Product/2', handle: 'product-b' }

const page = (nodes: Product[], hasNextPage: boolean, endCursor: string | null = null) => ({
  products: { pageInfo: { hasNextPage, endCursor }, nodes },
})

describe('exportProducts', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches one page and writes products.json', async () => {
    graphql.mockResolvedValueOnce(page([productA], false))
    await exportProducts()
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(outputJson).toHaveBeenCalledWith(expect.stringContaining('products.json'), [productA], {
      spaces: 2,
    })
  })

  it('follows pagination cursors and accumulates all products', async () => {
    graphql
      .mockResolvedValueOnce(page([productA], true, 'cur1'))
      .mockResolvedValueOnce(page([productB], false))
    await exportProducts()
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql).toHaveBeenNthCalledWith(2, 'prod.myshopify.com', expect.any(Object), {
      cursor: 'cur1',
    })
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('products.json'),
      [productA, productB],
      { spaces: 2 },
    )
  })

  it('passes empty vars on the first request (no cursor)', async () => {
    graphql.mockResolvedValueOnce(page([], false))
    await exportProducts()
    expect(graphql).toHaveBeenCalledWith('prod.myshopify.com', expect.any(Object), {})
  })
})
