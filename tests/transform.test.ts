import { describe, expect, it } from 'vitest'

describe('transform', () => {
  it('remaps product id', () => {
    const map: Record<string, string> = { 'gid://shopify/Product/123': 'gid://shopify/Product/456' }
    const srcId = 'gid://shopify/Product/123'
    const dstId = map[srcId]
    expect(dstId).toBe('gid://shopify/Product/456')
  })
})
