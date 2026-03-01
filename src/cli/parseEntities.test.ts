import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseEntities } from './parseEntities'

const mockExit = vi.spyOn(process, 'exit').mockImplementation((_code) => {
  throw new Error('process.exit')
})

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), success: vi.fn() },
}))

const setArgv = (...args: string[]) => {
  process.argv = ['node', 'cli', ...args]
}

beforeEach(() => {
  setArgv()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('parseEntities', () => {
  it('returns all entities when no args given', () => {
    expect(parseEntities()).toEqual(['products', 'collections'])
  })

  it('--only products returns only products', () => {
    setArgv('--only', 'products')
    expect(parseEntities()).toEqual(['products'])
  })

  it('--only collections returns only collections', () => {
    setArgv('--only', 'collections')
    expect(parseEntities()).toEqual(['collections'])
  })

  it('-o shorthand works', () => {
    setArgv('-o', 'products')
    expect(parseEntities()).toEqual(['products'])
  })

  it('--only repeated returns both', () => {
    setArgv('--only', 'products', '--only', 'collections')
    expect(parseEntities()).toEqual(['products', 'collections'])
  })

  it('--skip products returns only collections', () => {
    setArgv('--skip', 'products')
    expect(parseEntities()).toEqual(['collections'])
  })

  it('--skip collections returns only products', () => {
    setArgv('--skip', 'collections')
    expect(parseEntities()).toEqual(['products'])
  })

  it('-s shorthand works', () => {
    setArgv('-s', 'collections')
    expect(parseEntities()).toEqual(['products'])
  })

  it('invalid --only value exits with error', () => {
    setArgv('--only', 'orders')
    expect(() => parseEntities()).toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('invalid --skip value exits with error', () => {
    setArgv('--skip', 'customers')
    expect(() => parseEntities()).toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('--only and --skip together exits with error', () => {
    setArgv('--only', 'products', '--skip', 'collections')
    expect(() => parseEntities()).toThrow('process.exit')
    expect(mockExit).toHaveBeenCalledWith(1)
  })
})
