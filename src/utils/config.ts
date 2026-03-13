import 'dotenv/config'

export type SourceType = 'shopify' | 'matrixify-xlsx'

export const config = {
  SOURCE_SHOP: process.env.SOURCE_SHOP ?? 'your-source.myshopify.com',
  SOURCE_ACCESS_TOKEN: process.env.SOURCE_ACCESS_TOKEN ?? '',
  DEST_SHOP: process.env.DEST_SHOP ?? 'your-dest.myshopify.com',
  DEST_ACCESS_TOKEN: process.env.DEST_ACCESS_TOKEN ?? '',
  SOURCE_TYPE: (process.env.SOURCE_TYPE ?? 'shopify') as SourceType,
  SOURCE_XLSX_PATH: process.env.SOURCE_XLSX_PATH ?? '',
  API_VERSION: process.env.API_VERSION ?? '2026-01',
  SHOPIFY_PLAN: process.env.SHOPIFY_PLAN ?? 'plus',
  BATCH_SIZE: Number(process.env.BATCH_SIZE ?? 250),
  CONCURRENCY: Number(process.env.CONCURRENCY ?? 10),
  DATA_DIR: process.env.DATA_DIR ?? './data',
  MAPS_DIR: process.env.MAPS_DIR ?? './maps',
}
