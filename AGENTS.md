# Shiftify — Agent Guide

TypeScript CLI for migrating Shopify production store data (products, collections) to a dev store.

## Commands

```bash
node --version          # must be 18+  (.node-version = v24.13.0)
npm run export          # export from PROD_SHOP → data/
npm run import          # import to DEV_SHOP from data/
npm run export -- --only products --only collections
npm run import -- --only products
npm run test            # vitest run
npm run check           # biome lint + format (read-only check)
npm run format          # biome format --write
```

No build step — `tsx` runs TypeScript directly.

## Project Structure

```
src/
├── cli/
│   ├── export.ts           # entry: npm run export
│   └── import.ts           # entry: npm run import
├── types/
│   └── shopify.ts          # Product, ProductVariant, Collection, etc.
├── utils/
│   ├── config.ts           # env vars via dotenv
│   ├── logger.ts           # info / warn / error / success
│   ├── shopifyClient.ts    # GraphQL fetch + adaptive throttle + 429 retry
│   └── idMap.ts            # stub (not yet implemented)
├── exporters/shopify/
│   ├── products.ts         # paginated productExport → data/products.json
│   └── collections.ts      # paginated collectionExport + manual membership → data/collections.json
└── importers/shopify/
    ├── products.ts         # productCreate mutations → maps/product-id-map.json
    └── collections.ts      # collectionCreate + collectionAddProducts
```

```
data/           # export output (products.json, collections.json)
maps/           # product-id-map.json: { handle → new GID } written by importProducts
tests/          # vitest unit tests
```

## Key Conventions

- **ESM only** — all imports use `.js` extensions (e.g. `'./config.js'`)
- **Single quotes, no semicolons, 2-space indent, 100-char line width** (Biome)
- **No build step** — `tsx` executes TypeScript directly; `tsc --noEmit` is type-check only
- **No top-level await** — async logic lives inside `async function main()`
- **No type casts** — `value as SomeType` and `value!` are banned (`noExplicitAny` + `noNonNullAssertion` in Biome); `as const` is fine
- **Strict TypeScript** — `strict: true`; use type predicates (`(x): x is T =>`) instead of casts
- **GraphQL strings** tagged with `/* GraphQL */` comment for tooling support

## shopifyClient

`shopifyClient.graphql<T>(shop, query, vars?)` — generic, returns typed `data`.

- Shop must be `config.PROD_SHOP` or `config.DEV_SHOP`; unknown shops throw immediately
- Per-shop leaky-bucket state tracks `extensions.cost.throttleStatus` from each response
- Pre-request wait when projected available < 10% of max bucket
- Retries up to 3× on HTTP 429 using `Retry-After` header

## Export → Import Flow

1. `exportProducts` → `data/products.json` (all products with variants, options, images)
2. `exportCollections` → `data/collections.json` (metadata + ruleSet; manual collections include `productHandles[]`)
3. `importProducts` → creates products on DEV, writes `maps/product-id-map.json`
4. `importCollections` → loads map, creates collections, resolves manual membership via handle→GID lookup

Collections must be imported after products when manual collections are present.

## Environment

Copy `.env.example` to `.env`:

```
PROD_SHOP=your-prod.myshopify.com
PROD_ACCESS_TOKEN=shpat_xxx
DEV_SHOP=your-dev.myshopify.com
DEV_ACCESS_TOKEN=shpat_xxx
API_VERSION=2024-01
SHOPIFY_PLAN=plus          # plus | standard  (affects bucket size: 2000 | 1000)
BATCH_SIZE=250
CONCURRENCY=10
DATA_DIR=./data
MAPS_DIR=./maps
```

## What's Not Implemented

- `idMap` — stub only; importers use `maps/product-id-map.json` directly
- Customers / Orders — deferred to Phase 2 (PII masking required)
- Bulk Operations — Phase 1 uses regular GraphQL; bulk ops for 25k+ products later
- Metafields — not included in export/import queries
