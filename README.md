# Shiftify

TypeScript CLI tool for migrating Shopify production store data to dev store.

## Requirements

- **Node.js 18+** (native fetch, stable ESM)

## Setup

```bash
cp .env.example .env
# Edit .env with your Shopify credentials
npm install
```

## Usage

```bash
# Export all entities (products, collections)
npm run export

# Export specific entities
npm run export -- --only products
npm run export -- --only products --only collections

# Export everything except one entity
npm run export -- --skip collections

# Import all entities
npm run import

# Import specific entities
npm run import -- --only products

# Import everything except one entity
npm run import -- --skip products
```

## Scripts

| Script       | Description                    |
| ------------ | ------------------------------ |
| `npm run export` | Export from production store   |
| `npm run import` | Import to dev store            |
| `npm run test` | Unit tests                     |
| `npm run test:integration` | Live integration tests (requires `.env.test.integration`) |
| `npm run codegen` | Regenerate `src/gql/` from `.graphql` files |
| `npm run typecheck` | TypeScript check               |
| `npm run check` | Biome lint + format            |
| `npm run format` | Biome format --write           |

## Project Structure

```
src/
├── cli/           # CLI entry points
├── types/         # Entity types
├── utils/         # Config, logger, shopifyClient, idMap
├── exporters/shopify/
└── importers/shopify/
```
