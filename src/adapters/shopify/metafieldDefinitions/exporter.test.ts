import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MetafieldOwnerType } from '#gql/graphql'
import type { MetafieldDefinition } from '#types/shopify'

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

import { exportMetafieldDefinitions } from './exporter'

const defA: MetafieldDefinition = {
  name: 'Material',
  namespace: 'custom',
  key: 'material',
  description: null,
  type: 'single_line_text_field',
  ownerType: 'PRODUCT',
  pinnedPosition: null,
  validations: [],
}

const defB: MetafieldDefinition = {
  name: 'Weight Limit',
  namespace: 'custom',
  key: 'weight_limit',
  description: 'Max weight in kg',
  type: 'number_integer',
  ownerType: 'PRODUCT',
  pinnedPosition: 1,
  validations: [{ name: 'max', type: 'number_integer', value: '100' }],
}

// Mock node shape returned by Shopify API
const apiNode = (def: MetafieldDefinition) => ({
  name: def.name,
  namespace: def.namespace,
  key: def.key,
  description: def.description,
  type: { name: def.type },
  ownerType: def.ownerType,
  pinnedPosition: def.pinnedPosition,
  validations: def.validations.map((v) => ({ name: v.name, type: v.type, value: v.value })),
})

const page = (
  nodes: MetafieldDefinition[],
  hasNextPage: boolean,
  endCursor: string | null = null,
) => ({
  metafieldDefinitions: { pageInfo: { hasNextPage, endCursor }, nodes: nodes.map(apiNode) },
})

// Number of owner types the exporter iterates over
const OWNER_TYPE_COUNT = 10

describe('exportMetafieldDefinitions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('queries all owner types and writes metafield-definitions.json', async () => {
    // Return empty for all owner types
    graphql.mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    expect(graphql).toHaveBeenCalledTimes(OWNER_TYPE_COUNT)
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('metafield-definitions.json'),
      [],
      { spaces: 2 },
    )
  })

  it('accumulates definitions across owner types', async () => {
    // First owner type (PRODUCT) returns defA; rest return empty
    graphql.mockResolvedValueOnce(page([defA], false)).mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    expect(outputJson).toHaveBeenCalledWith(
      expect.stringContaining('metafield-definitions.json'),
      [defA],
      { spaces: 2 },
    )
  })

  it('follows pagination cursors within a single owner type', async () => {
    graphql
      .mockResolvedValueOnce(page([defA], true, 'cur1'))
      .mockResolvedValueOnce(page([defB], false))
      .mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    // PRODUCT owner type needed 2 requests; remaining 9 needed 1 each
    expect(graphql).toHaveBeenCalledTimes(OWNER_TYPE_COUNT + 1)
    const written = outputJson.mock.calls[0][1] as MetafieldDefinition[]
    expect(written).toHaveLength(2)
    expect(written[0].key).toBe('material')
    expect(written[1].key).toBe('weight_limit')
  })

  it('passes cursor on second page request', async () => {
    graphql
      .mockResolvedValueOnce(page([defA], true, 'cursor-abc'))
      .mockResolvedValueOnce(page([], false))
      .mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    expect(graphql).toHaveBeenNthCalledWith(2, 'prod.myshopify.com', expect.any(Object), {
      ownerType: MetafieldOwnerType.Product,
      cursor: 'cursor-abc',
    })
  })

  it('maps null description and pinnedPosition correctly', async () => {
    graphql.mockResolvedValueOnce(page([defA], false)).mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    const written = outputJson.mock.calls[0][1] as MetafieldDefinition[]
    expect(written[0].description).toBeNull()
    expect(written[0].pinnedPosition).toBeNull()
  })

  it('preserves validations with their values', async () => {
    graphql.mockResolvedValueOnce(page([defB], false)).mockResolvedValue(page([], false))
    await exportMetafieldDefinitions()
    const written = outputJson.mock.calls[0][1] as MetafieldDefinition[]
    expect(written[0].validations).toEqual([{ name: 'max', type: 'number_integer', value: '100' }])
  })
})
