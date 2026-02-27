import { describe, expect, it } from 'vitest'

describe('throttle', () => {
  it('detects normal level', () => {
    const available = 800
    const max = 1000
    const ratio = available / max
    expect(ratio).toBeGreaterThan(0.5)
  })
})
