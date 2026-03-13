import path from 'node:path'
import fs from 'fs-extra'
import minimist from 'minimist'
import { type ExportToXlsxEntity, writeToXlsx } from '#adapters/matrixify'
import type { Collection, Product } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { getDryRun } from './parseEntities'

const XLSX_ENTITIES: readonly ExportToXlsxEntity[] = ['products', 'collections']

const getArgv = () => minimist(process.argv.slice(2))

const getOnly = (): ExportToXlsxEntity[] | undefined => {
  const argv = getArgv()
  const raw = argv.only ?? argv.o
  if (raw === undefined) return undefined
  const only = [raw].flat().filter(Boolean).map(String)
  if (only.length === 0) return undefined
  const invalid = only.filter((e) => !XLSX_ENTITIES.includes(e as ExportToXlsxEntity))
  if (invalid.length) {
    logger.error(
      `Invalid --only for export-to-xlsx: ${invalid.join(', ')}. Valid: ${XLSX_ENTITIES.join(', ')}`,
    )
    process.exit(1)
  }
  return only as ExportToXlsxEntity[]
}

const getOutputPath = (): string => {
  const argv = getArgv()
  const raw = argv.output
  if (raw && typeof raw === 'string') return path.resolve(raw)
  return config.EXPORT_XLSX_PATH
    ? path.resolve(config.EXPORT_XLSX_PATH)
    : path.join(config.DATA_DIR, 'export.xlsx')
}

const main = async () => {
  const dryRun = getDryRun()
  const outputPath = getOutputPath()
  const only = getOnly()

  const productsPath = path.join(config.DATA_DIR, 'products.json')
  const collectionsPath = path.join(config.DATA_DIR, 'collections.json')

  let products: unknown[] = []
  let collections: unknown[] = []

  const loadProducts = !only || only.includes('products')
  const loadCollections = !only || only.includes('collections')

  if (loadProducts && (await fs.pathExists(productsPath))) {
    const raw = await fs.readJson(productsPath)
    products = Array.isArray(raw) ? raw : []
  }
  if (loadCollections && (await fs.pathExists(collectionsPath))) {
    const raw = await fs.readJson(collectionsPath)
    collections = Array.isArray(raw) ? raw : []
  }

  if (products.length === 0 && collections.length === 0) {
    logger.warn(
      'No products.json or collections.json found in DATA_DIR; output XLSX will have empty sheets.',
    )
  }

  const parts: string[] = []
  if (loadProducts) parts.push(`${products.length} products`)
  if (loadCollections) parts.push(`${collections.length} collections`)
  logger.info(
    dryRun
      ? `Would write XLSX (${parts.join(', ')}) → ${outputPath}`
      : `Writing XLSX (${parts.join(', ')}) → ${outputPath}`,
  )

  await writeToXlsx(outputPath, {
    products: products as Product[],
    collections: collections as Collection[],
    only,
    dryRun,
  })

  if (!dryRun) logger.success(`Exported XLSX → ${outputPath}`)
}

main().catch((err) => {
  logger.error(String(err))
  process.exit(1)
})
