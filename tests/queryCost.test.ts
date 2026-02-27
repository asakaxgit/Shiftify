import { describe, expect, it } from 'vitest'

describe('queryCost', () => {
  it('estimates product cost', () => {
    const n = 10
    const cost = (2 + n * 3) * 1.2
    expect(cost).toBe(38.4)
  })
})
