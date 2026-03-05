import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '#types/shopify'

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

import { exportCollections } from './exporter'

const smartCol: Collection = {
  id: 'gid://shopify/Collection/1',
  title: 'Smart',
  handle: 'smart',
  descriptionHtml: '',
  sortOrder: 'BEST_SELLING',
  templateSuffix: null,
  image: null,
  ruleSet: {
    appliedDisjunctively: false,
    rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'sale' }],
  },
}
const manualCol: Collection = {
  id: 'gid://shopify/Collection/2',
  title: 'Manual',
  handle: 'manual',
  descriptionHtml: '',
  sortOrder: 'MANUAL',
  templateSuffix: null,
  image: null,
  ruleSet: null,
}

const colPage = (nodes: Collection[], hasNextPage = false, endCursor: string | null = null) => ({
  collections: { pageInfo: { hasNextPage, endCursor }, nodes },
})
const handlePage = (handles: string[], hasNextPage = false, endCursor: string | null = null) => ({
  collection: {
    products: { pageInfo: { hasNextPage, endCursor }, nodes: handles.map((h) => ({ handle: h })) },
  },
})

describe('exportCollections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('exports smart collections without fetching product handles', async () => {
    graphql.mockResolvedValueOnce(colPage([smartCol]))
    await exportCollections()
    expect(graphql).toHaveBeenCalledTimes(1)
    const written = outputJson.mock.calls[0][1] as Collection[]
    expect(written[0].ruleSet).toBeDefined()
    expect(written[0].productHandles).toBeUndefined()
  })

  it('fetches product handles for manual collections and attaches them', async () => {
    graphql
      .mockResolvedValueOnce(colPage([manualCol]))
      .mockResolvedValueOnce(handlePage(['product-a', 'product-b']))
    await exportCollections()
    const written = outputJson.mock.calls[0][1] as Collection[]
    expect(written[0].productHandles).toEqual(['product-a', 'product-b'])
  })

  it('follows pagination for manual product handles', async () => {
    graphql
      .mockResolvedValueOnce(colPage([manualCol]))
      .mockResolvedValueOnce(handlePage(['product-a'], true, 'hcur1'))
      .mockResolvedValueOnce(handlePage(['product-b']))
    await exportCollections()
    expect(graphql).toHaveBeenCalledTimes(3)
    const written = outputJson.mock.calls[0][1] as Collection[]
    expect(written[0].productHandles).toEqual(['product-a', 'product-b'])
  })

  it('follows pagination for the top-level collection list', async () => {
    graphql
      .mockResolvedValueOnce(colPage([smartCol], true, 'ccur1'))
      .mockResolvedValueOnce(colPage([manualCol]))
      .mockResolvedValueOnce(handlePage([]))
    await exportCollections()
    const written = outputJson.mock.calls[0][1] as Collection[]
    expect(written).toHaveLength(2)
  })

  it('writes collections.json', async () => {
    graphql.mockResolvedValueOnce(colPage([smartCol]))
    await exportCollections()
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('collections.json'),
      expect.any(Array),
      { spaces: 2 },
    )
  })
})
