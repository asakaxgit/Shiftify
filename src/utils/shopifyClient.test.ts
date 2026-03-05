import { describe, expect, it, vi } from 'vitest'
import type { BucketState } from '#utils/shopifyClient'
import { projectAvailable, shopifyClient } from '#utils/shopifyClient'

vi.mock('#utils/config', () => ({
  config: {
    SOURCE_SHOP: 'prod.myshopify.com',
    DEST_SHOP: 'dev.myshopify.com',
    SOURCE_ACCESS_TOKEN: 'tok-prod',
    DEST_ACCESS_TOKEN: 'tok-dev',
    API_VERSION: '2024-01',
    SHOPIFY_PLAN: 'standard',
  },
}))
vi.mock('#utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

// ─── graphql ─────────────────────────────────────────────────────────────────

const okResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  headers: { get: () => null },
  text: () => Promise.resolve(JSON.stringify({ data })),
})

const rateLimitResponse = (retryAfter = '0') => ({
  ok: false,
  status: 429,
  headers: { get: (k: string) => (k === 'Retry-After' ? retryAfter : null) },
  text: () => Promise.resolve('rate limited'),
})

describe('shopifyClient.graphql', () => {
  it('returns data on a successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse({ products: [] })))
    const result = await shopifyClient.graphql(
      'prod.myshopify.com',
      '{ products { nodes { id } } }',
    )
    expect(result).toEqual({ products: [] })
  })

  it('throws for an unknown shop', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await expect(shopifyClient.graphql('unknown.myshopify.com', 'query')).rejects.toThrow(
      'Unknown shop',
    )
  })

  it('throws on GraphQL errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: () => Promise.resolve(JSON.stringify({ errors: [{ message: 'Access denied' }] })),
      }),
    )
    await expect(shopifyClient.graphql('dev.myshopify.com', 'query')).rejects.toThrow(
      'Access denied',
    )
  })

  it('throws on a non-ok HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
        text: () => Promise.resolve('Internal Server Error'),
      }),
    )
    await expect(shopifyClient.graphql('prod.myshopify.com', 'query')).rejects.toThrow('HTTP 500')
  })

  it('retries on 429 and returns data on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse('0'))
      .mockResolvedValue(okResponse({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await shopifyClient.graphql('prod.myshopify.com', 'query')
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retries on persistent 429', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rateLimitResponse('0')))
    await expect(shopifyClient.graphql('dev.myshopify.com', 'query')).rejects.toThrow('429')
  })
})

// ─── projectAvailable ─────────────────────────────────────────────────────────

const bucket = (overrides: Partial<BucketState> = {}): BucketState => ({
  available: 1000,
  maximum: 1000,
  restoreRate: 50,
  updatedAt: Date.now(),
  ...overrides,
})

describe('projectAvailable', () => {
  it('returns current available when no time has elapsed', () => {
    expect(projectAvailable(bucket({ available: 800 }))).toBeCloseTo(800, 0)
  })

  it('adds restored points proportional to elapsed time', () => {
    const b = bucket({ available: 600, restoreRate: 50, updatedAt: Date.now() - 4_000 })
    expect(projectAvailable(b)).toBeCloseTo(800, 0) // 600 + 4s * 50pts/s
  })

  it('caps projection at maximum', () => {
    const b = bucket({
      available: 900,
      maximum: 1000,
      restoreRate: 50,
      updatedAt: Date.now() - 100_000,
    })
    expect(projectAvailable(b)).toBe(1000)
  })

  it('fully restores when elapsed time exceeds depletion', () => {
    const b = bucket({
      available: 500,
      maximum: 1000,
      restoreRate: 50,
      updatedAt: Date.now() - 10_000,
    })
    expect(projectAvailable(b)).toBe(1000) // 500 + 10s * 50pts/s = 1000
  })

  it('handles a plus-plan bucket (2000 max, 100pts/s)', () => {
    const b = bucket({
      available: 1000,
      maximum: 2000,
      restoreRate: 100,
      updatedAt: Date.now() - 5_000,
    })
    expect(projectAvailable(b)).toBeCloseTo(1500, 0) // 1000 + 5s * 100pts/s
  })
})
