import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'

vi.mock('#utils/config', () => ({
  config: { DATA_DIR: './data' },
}))
vi.mock('#utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), success: vi.fn() },
}))

const readFile = vi.hoisted(() => vi.fn())
const outputJson = vi.hoisted(() => vi.fn())
vi.mock('fs-extra', () => ({
  default: {
    readFile: (...args: unknown[]) => readFile(...args),
    outputJson: (...args: unknown[]) => outputJson(...args),
  },
}))

import {
  exportMetafieldDefinitionsFromMatrixifyXlsx,
  inferFromWorkbook,
} from './metafieldDefinitions'

const buildWorkbook = (productHeaders: string[], collectionHeaders?: string[]): XLSX.WorkBook => {
  const productSheet = XLSX.utils.aoa_to_sheet([productHeaders])
  const wb = XLSX.utils.book_new(productSheet, 'Products')
  if (collectionHeaders && collectionHeaders.length > 0) {
    const collSheet = XLSX.utils.aoa_to_sheet([collectionHeaders])
    XLSX.utils.book_append_sheet(wb, collSheet, 'Smart Collections')
  }
  return wb
}

describe('inferFromWorkbook', () => {
  it('parses product and variant metafield column headers from Products sheet', () => {
    const wb = buildWorkbook([
      'Handle',
      'Title',
      'Metafield: custom.material [single_line_text_field]',
      'Variant Metafield: custom.size [single_line_text_field]',
    ])
    const defs = inferFromWorkbook(wb)
    expect(defs).toHaveLength(2)
    const productDef = defs.find((d) => d.ownerType === 'PRODUCT' && d.key === 'material')
    const variantDef = defs.find((d) => d.ownerType === 'PRODUCTVARIANT' && d.key === 'size')
    expect(productDef).toEqual({
      name: 'material',
      namespace: 'custom',
      key: 'material',
      description: null,
      type: 'single_line_text_field',
      ownerType: 'PRODUCT',
      pinnedPosition: null,
      validations: [],
    })
    expect(variantDef).toEqual({
      name: 'size',
      namespace: 'custom',
      key: 'size',
      description: null,
      type: 'single_line_text_field',
      ownerType: 'PRODUCTVARIANT',
      pinnedPosition: null,
      validations: [],
    })
  })

  it('parses collection metafield headers from Smart Collections sheet', () => {
    const wb = buildWorkbook(
      ['Handle', 'Title'],
      ['Handle', 'Metafield: custom.theme [single_line_text_field]'],
    )
    const defs = inferFromWorkbook(wb)
    const collDef = defs.find((d) => d.ownerType === 'COLLECTION' && d.key === 'theme')
    expect(collDef).toBeDefined()
    expect(collDef?.namespace).toBe('custom')
    expect(collDef?.type).toBe('single_line_text_field')
    expect(collDef?.description).toBeNull()
    expect(collDef?.validations).toEqual([])
    expect(collDef?.pinnedPosition).toBeNull()
  })

  it('dedupes by namespace, key, ownerType', () => {
    const wb = buildWorkbook([
      'Metafield: custom.dup [number_integer]',
      'Metafield: custom.dup [number_integer]',
    ])
    const defs = inferFromWorkbook(wb)
    expect(defs.filter((d) => d.namespace === 'custom' && d.key === 'dup')).toHaveLength(1)
  })

  it('returns empty array when sheet has no metafield columns', () => {
    const wb = buildWorkbook(['Handle', 'Title', 'Body HTML'])
    const defs = inferFromWorkbook(wb)
    expect(defs).toHaveLength(0)
  })

  it('unescapes dots in namespace and key', () => {
    const wb = buildWorkbook(['Metafield: my\\.ns.my\\.key [single_line_text_field]'])
    const defs = inferFromWorkbook(wb)
    expect(defs).toHaveLength(1)
    expect(defs[0].namespace).toBe('my.ns')
    expect(defs[0].key).toBe('my.key')
  })

  it('parses alternate format "Label (product.metafields.namespace.key)" without type', () => {
    const wb = buildWorkbook([
      'Handle',
      'Exclude from search (product.metafields.custom.exclude_from_search)',
      'Estimated shipping (product.metafields.myapp.estimated_shipping)',
    ])
    const defs = inferFromWorkbook(wb)
    expect(defs).toHaveLength(2)
    const exclude = defs.find((d) => d.key === 'exclude_from_search')
    expect(exclude).toEqual({
      name: 'Exclude from search',
      namespace: 'custom',
      key: 'exclude_from_search',
      description: null,
      type: 'single_line_text_field',
      ownerType: 'PRODUCT',
      pinnedPosition: null,
      validations: [],
    })
    const shipping = defs.find((d) => d.key === 'estimated_shipping')
    expect(shipping?.namespace).toBe('myapp')
    expect(shipping?.name).toBe('Estimated shipping')
  })

  it('excludes shopify-- built-in namespaces (e.g. discovery, product_recommendation)', () => {
    const wb = buildWorkbook([
      'Related (product.metafields.shopify--discovery--product_recommendation.related_products)',
      'Boost (product.metafields.shopify--discovery--product_search_boost.queries)',
    ])
    const defs = inferFromWorkbook(wb)
    expect(defs).toHaveLength(0)
  })
})

describe('exportMetafieldDefinitionsFromMatrixifyXlsx', () => {
  beforeEach(() => {
    readFile.mockReset()
    outputJson.mockReset()
  })

  it('writes metafield-definitions.json with inferred definitions', async () => {
    const wb = buildWorkbook(['Handle', 'Metafield: custom.material [single_line_text_field]'])
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    readFile.mockResolvedValue(buf)
    outputJson.mockResolvedValue(undefined)

    await exportMetafieldDefinitionsFromMatrixifyXlsx('/tmp/export.xlsx')

    expect(readFile).toHaveBeenCalledWith('/tmp/export.xlsx')
    expect(outputJson).toHaveBeenCalledWith(
      'data/metafield-definitions.json',
      expect.arrayContaining([
        expect.objectContaining({
          namespace: 'custom',
          key: 'material',
          type: 'single_line_text_field',
          ownerType: 'PRODUCT',
          description: null,
          validations: [],
          pinnedPosition: null,
        }),
      ]),
      { spaces: 2 },
    )
  })

  it('writes empty array when no metafield columns present', async () => {
    const wb = buildWorkbook(['Handle', 'Title'])
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    readFile.mockResolvedValue(buf)
    outputJson.mockResolvedValue(undefined)

    await exportMetafieldDefinitionsFromMatrixifyXlsx('/tmp/empty.xlsx')

    expect(outputJson).toHaveBeenCalledWith('data/metafield-definitions.json', [], { spaces: 2 })
  })

  it('dry-run: reads XLSX but does not write outputJson', async () => {
    const wb = buildWorkbook(['Handle', 'Metafield: custom.material [single_line_text_field]'])
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    readFile.mockResolvedValue(buf)

    await exportMetafieldDefinitionsFromMatrixifyXlsx('/tmp/export.xlsx', { dryRun: true })

    expect(readFile).toHaveBeenCalledWith('/tmp/export.xlsx')
    expect(outputJson).not.toHaveBeenCalled()
  })
})
