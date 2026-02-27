import { describe, expect, it } from 'vitest'
import { idMap } from './idMap'

describe('idMap', () => {
  it('loads empty map', () => {
    const map = idMap.load()
    expect(map.products).toEqual({})
    expect(map.variants).toEqual({})
    expect(map.collections).toEqual({})
  })
})
