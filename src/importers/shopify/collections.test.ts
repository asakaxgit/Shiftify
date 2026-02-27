import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '../../types/shopify'

vi.mock('../../utils/config.js', () => ({
  config: { DEV_SHOP: 'dev.myshopify.com', DATA_DIR: './data', MAPS_DIR: './maps' },
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const graphql = vi.hoisted(() => vi.fn())
vi.mock('../../utils/shopifyClient.js', () => ({ shopifyClient: { graphql } }))

const readJson = vi.hoisted(() => vi.fn())
const pathExists = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({ readJson, pathExists }))

import { importCollections } from './collections'

const smartCol: Collection = {
  id: 'gid://shopify/Collection/1', title: 'Smart', handle: 'smart-col', descriptionHtml: '',
  sortOrder: 'BEST_SELLING', templateSuffix: null, image: null,
  ruleSet: { appliedDisjunctively: false, rules: [{ column: 'TAG', relation: 'EQUALS', condition: 'sale' }] },
}
const manualCol: Collection = {
  id: 'gid://shopify/Collection/2', title: 'Manual', handle: 'manual-col', descriptionHtml: '',
  sortOrder: 'MANUAL', templateSuffix: null, image: null, ruleSet: null,
  productHandles: ['product-a', 'product-b'],
}

const createOk = (id = 'gid://shopify/Collection/99', handle = 'smart-col') => ({
  collectionCreate: { collection: { id, handle }, userErrors: [] },
})
const createError = (message: string) => ({
  collectionCreate: { collection: null, userErrors: [{ field: ['handle'], message }] },
})
const addProductsOk = () => ({
  collectionAddProducts: { collection: { id: 'gid://shopify/Collection/99' }, userErrors: [] },
})

describe('importCollections', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a smart collection with its ruleSet', async () => {
    readJson.mockResolvedValue([smartCol])
    pathExists.mockResolvedValue(false)
    graphql.mockResolvedValue(createOk())
    await importCollections()
    expect(graphql.mock.calls[0][2].input.ruleSet).toEqual(smartCol.ruleSet)
  })

  it('creates a manual collection and calls collectionAddProducts', async () => {
    readJson
      .mockResolvedValueOnce([manualCol])
      .mockResolvedValueOnce({ 'product-a': 'gid://shopify/Product/1', 'product-b': 'gid://shopify/Product/2' })
    pathExists.mockResolvedValue(true)
    graphql
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/99', 'manual-col'))
      .mockResolvedValueOnce(addProductsOk())
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls[1][2].productIds).toEqual(['gid://shopify/Product/1', 'gid://shopify/Product/2'])
  })

  it('warns and skips product membership when id map is missing', async () => {
    const { logger } = await import('../../utils/logger')
    readJson.mockResolvedValue([manualCol])
    pathExists.mockResolvedValue(false)
    graphql.mockResolvedValue(createOk('gid://shopify/Collection/99', 'manual-col'))
    await importCollections()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('product-id-map.json'))
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it('skips a collection on userErrors', async () => {
    readJson.mockResolvedValue([smartCol])
    pathExists.mockResolvedValue(false)
    graphql.mockResolvedValue(createError('Handle already taken'))
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(1)
  })

  it('logs an error and continues when graphql throws', async () => {
    const secondCol: Collection = { ...smartCol, handle: 'second-col' }
    readJson.mockResolvedValue([smartCol, secondCol])
    pathExists.mockResolvedValue(false)
    graphql
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/2', 'second-col'))
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(2)
  })
})
