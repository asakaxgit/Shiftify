import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Collection } from '#types/shopify'

vi.mock('#utils/config', () => ({
  config: {
    DEST_SHOP: 'dev.myshopify.com',
    DATA_DIR: './data',
    MAPS_DIR: './maps',
    COLLECTION_PUBLISH_CHANNELS: '',
  },
}))
vi.mock('#utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const graphql = vi.hoisted(() => vi.fn())
vi.mock('#utils/shopifyClient', () => ({ shopifyClient: { graphql } }))

const readJson = vi.hoisted(() => vi.fn())
const pathExists = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({ default: { readJson, pathExists } }))

import { PublishablePublishDocument } from '#gql/graphql'
import { importCollections } from './importer'

const smartCol: Collection = {
  id: 'gid://shopify/Collection/1',
  title: 'Smart',
  handle: 'smart-col',
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
  handle: 'manual-col',
  descriptionHtml: '',
  sortOrder: 'MANUAL',
  templateSuffix: null,
  image: null,
  ruleSet: null,
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
    graphql
      .mockResolvedValueOnce({ publications: { nodes: [] } })
      .mockResolvedValueOnce(createOk())
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(2)
    expect(graphql.mock.calls[1][2].input.ruleSet).toEqual(smartCol.ruleSet)
  })

  it('creates a manual collection and calls collectionAddProducts', async () => {
    readJson.mockResolvedValueOnce([manualCol]).mockResolvedValueOnce({
      'product-a': 'gid://shopify/Product/1',
      'product-b': 'gid://shopify/Product/2',
    })
    pathExists.mockResolvedValue(true)
    graphql
      .mockResolvedValueOnce({ publications: { nodes: [] } })
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/99', 'manual-col'))
      .mockResolvedValueOnce(addProductsOk())
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(3)
    expect(graphql.mock.calls[2][2].productIds).toEqual([
      'gid://shopify/Product/1',
      'gid://shopify/Product/2',
    ])
  })

  it('warns and skips product membership when id map is missing', async () => {
    const { logger } = await import('#utils/logger')
    readJson.mockResolvedValue([manualCol])
    pathExists.mockResolvedValue(false)
    graphql
      .mockResolvedValueOnce({ publications: { nodes: [] } })
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/99', 'manual-col'))
    await importCollections()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('product-id-map.json'))
    expect(graphql).toHaveBeenCalledTimes(2)
  })

  it('skips a collection on userErrors', async () => {
    readJson.mockResolvedValue([smartCol])
    pathExists.mockResolvedValue(false)
    graphql
      .mockResolvedValueOnce({ publications: { nodes: [] } })
      .mockResolvedValueOnce(createError('Handle already taken'))
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(2)
  })

  it('logs an error and continues when graphql throws', async () => {
    const secondCol: Collection = { ...smartCol, handle: 'second-col' }
    readJson.mockResolvedValue([smartCol, secondCol])
    pathExists.mockResolvedValue(false)
    graphql
      .mockResolvedValueOnce({ publications: { nodes: [] } })
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/2', 'second-col'))
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(3)
  })

  it('dry-run: reads data but does not call graphql', async () => {
    readJson.mockResolvedValue([smartCol])
    pathExists.mockResolvedValue(false)
    await importCollections({ dryRun: true })
    expect(graphql).not.toHaveBeenCalled()
  })

  it('publishes created collection to Online Store when available', async () => {
    const onlineStoreId = 'gid://shopify/Publication/1'
    readJson.mockResolvedValue([smartCol])
    pathExists.mockResolvedValue(false)
    graphql
      .mockResolvedValueOnce({
        publications: { nodes: [{ id: onlineStoreId, name: 'Online Store' }] },
      })
      .mockResolvedValueOnce(createOk('gid://shopify/Collection/99', 'smart-col'))
      .mockResolvedValueOnce({ publishablePublish: { userErrors: [] } })
    await importCollections()
    expect(graphql).toHaveBeenCalledTimes(3)
    expect(graphql.mock.calls[2][1]).toBe(PublishablePublishDocument)
    expect(graphql.mock.calls[2][2]).toEqual({
      id: 'gid://shopify/Collection/99',
      input: [{ publicationId: onlineStoreId }],
    })
  })
})
