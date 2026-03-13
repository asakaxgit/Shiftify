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
vi.mock('fs-extra', () => ({ default: { outputJson } }))

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
    expect(graphql).toHaveBeenCalledWith('prod.myshopify.com', expect.any(Object), { first: 100 })
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
      first: 100,
      cursor: 'cur1',
    })
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('products.json'),
      [productA, productB],
      { spaces: 2 },
    )
  })

  it('passes first and optional query on requests', async () => {
    graphql.mockResolvedValueOnce(page([], false))
    await exportProducts()
    expect(graphql).toHaveBeenCalledWith('prod.myshopify.com', expect.any(Object), { first: 100 })
  })

  it('passes query when provided', async () => {
    graphql.mockResolvedValueOnce(page([productA], false))
    await exportProducts({ query: 'status:active' })
    expect(graphql).toHaveBeenCalledWith('prod.myshopify.com', expect.any(Object), {
      first: 100,
      query: 'status:active',
    })
  })

  it('stops at limit and slices last page', async () => {
    graphql
      .mockResolvedValueOnce(page([productA], true, 'cur1'))
      .mockResolvedValueOnce(page([productB], false))
    await exportProducts({ limit: 1 })
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(graphql).toHaveBeenNthCalledWith(1, 'prod.myshopify.com', expect.any(Object), {
      first: 1,
    })
    expect(outputJson).toHaveBeenCalledWith(expect.stringContaining('products.json'), [productA], {
      spaces: 2,
    })
  })

  it('dry-run: fetches data but does not write outputJson', async () => {
    graphql.mockResolvedValueOnce(page([productA], false))
    await exportProducts({ dryRun: true })
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(outputJson).not.toHaveBeenCalled()
  })

  it('dry-run: fetches data but does not write outputJson', async () => {
    graphql.mockResolvedValueOnce(page([productA], false))
    await exportProducts({ dryRun: true })
    expect(graphql).toHaveBeenCalledTimes(1)
    expect(outputJson).not.toHaveBeenCalled()
  })
})
