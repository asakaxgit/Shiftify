import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MetafieldDefinition } from '#types/shopify'

vi.mock('#utils/config', () => ({
  config: { DEST_SHOP: 'dev.myshopify.com', CONCURRENCY: 5, DATA_DIR: './data' },
}))
vi.mock('#utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))
vi.mock('p-limit', () => ({ default: () => (fn: () => unknown) => fn() }))

const graphql = vi.hoisted(() => vi.fn())
vi.mock('#utils/shopifyClient', () => ({ shopifyClient: { graphql } }))

const readJson = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({ default: { readJson } }))

import { importMetafieldDefinitions } from './importer'

const def: MetafieldDefinition = {
  name: 'Material',
  namespace: 'custom',
  key: 'material',
  description: null,
  type: 'single_line_text_field',
  ownerType: 'PRODUCT',
  pinnedPosition: null,
  validations: [],
}

const defWithValidation: MetafieldDefinition = {
  ...def,
  key: 'weight_limit',
  type: 'number_integer',
  pinnedPosition: 1,
  validations: [{ name: 'max', type: 'number_integer', value: '100' }],
}

const createOk = () => ({
  metafieldDefinitionCreate: {
    createdDefinition: {
      id: 'gid://shopify/MetafieldDefinition/1',
      name: 'Material',
      namespace: 'custom',
      key: 'material',
    },
    userErrors: [],
  },
})

const createError = (message: string) => ({
  metafieldDefinitionCreate: {
    createdDefinition: null,
    userErrors: [{ field: ['key'], message, code: 'TAKEN' }],
  },
})

describe('importMetafieldDefinitions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls metafieldDefinitionCreate with correct shop', async () => {
    readJson.mockResolvedValue([def])
    graphql.mockResolvedValue(createOk())
    await importMetafieldDefinitions()
    expect(graphql).toHaveBeenCalledWith(
      'dev.myshopify.com',
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('builds definition input from MetafieldDefinition type', async () => {
    readJson.mockResolvedValue([def])
    graphql.mockResolvedValue(createOk())
    await importMetafieldDefinitions()
    expect(graphql).toHaveBeenCalledWith('dev.myshopify.com', expect.any(Object), {
      definition: {
        name: 'Material',
        namespace: 'custom',
        key: 'material',
        description: null,
        type: 'single_line_text_field',
        ownerType: 'PRODUCT',
        pin: false,
        validations: [],
      },
    })
  })

  it('sets pin: true when pinnedPosition is not null', async () => {
    readJson.mockResolvedValue([defWithValidation])
    graphql.mockResolvedValue(createOk())
    await importMetafieldDefinitions()
    const call = graphql.mock.calls[0][2]
    expect(call.definition.pin).toBe(true)
  })

  it('passes validations with value coerced from null to empty string', async () => {
    const defNullVal: MetafieldDefinition = {
      ...def,
      validations: [{ name: 'min', type: 'number_integer', value: null }],
    }
    readJson.mockResolvedValue([defNullVal])
    graphql.mockResolvedValue(createOk())
    await importMetafieldDefinitions()
    const call = graphql.mock.calls[0][2]
    expect(call.definition.validations).toEqual([{ name: 'min', value: '' }])
  })

  it('skips on userErrors and does not throw', async () => {
    readJson.mockResolvedValue([def])
    graphql.mockResolvedValue(createError('Key has already been taken'))
    await expect(importMetafieldDefinitions()).resolves.toBeUndefined()
  })

  it('handles a thrown graphql error without rejecting', async () => {
    readJson.mockResolvedValue([def])
    graphql.mockRejectedValue(new Error('Network error'))
    await expect(importMetafieldDefinitions()).resolves.toBeUndefined()
  })

  it('processes multiple definitions', async () => {
    readJson.mockResolvedValue([def, defWithValidation])
    graphql.mockResolvedValue(createOk())
    await importMetafieldDefinitions()
    expect(graphql).toHaveBeenCalledTimes(2)
  })

  it('dry-run: reads data but does not call graphql', async () => {
    readJson.mockResolvedValue([def])
    await importMetafieldDefinitions({ dryRun: true })
    expect(graphql).not.toHaveBeenCalled()
  })
})
