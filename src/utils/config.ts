import 'dotenv/config'

export const config = {
  PROD_SHOP: process.env.PROD_SHOP ?? 'your-prod.myshopify.com',
  PROD_ACCESS_TOKEN: process.env.PROD_ACCESS_TOKEN ?? '',
  DEV_SHOP: process.env.DEV_SHOP ?? 'your-dev.myshopify.com',
  DEV_ACCESS_TOKEN: process.env.DEV_ACCESS_TOKEN ?? '',
  API_VERSION: process.env.API_VERSION ?? '2024-01',
  SHOPIFY_PLAN: process.env.SHOPIFY_PLAN ?? 'plus',
  BATCH_SIZE: Number(process.env.BATCH_SIZE ?? 250),
  CONCURRENCY: Number(process.env.CONCURRENCY ?? 10),
  DATA_DIR: process.env.DATA_DIR ?? './data',
  MAPS_DIR: process.env.MAPS_DIR ?? './maps',
}
