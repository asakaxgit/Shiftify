# Shiftify — Handoff

## What It Is

TypeScript CLI for migrating Shopify production store data (products, collections) to a dev store. Phase 1 scaffolding is complete; core logic (GraphQL client, exporters, importers) is stubbed.

## Current State

- **Scaffolding**: Done. Config, types, utils, exporters, importers, CLI, tests.
- **CLI**: `npm run export` and `npm run import` work with `--only products,collections`.
- **Tests**: Stubs pass; Vitest requires Node 18+ (`.node-version` = v24.13.0).

## Key Files

| Path | Purpose |
|------|---------|
| `src/cli/export.ts`, `import.ts` | CLI entry points (minimist, thin wrappers) |
| `src/utils/config.ts` | Env via dotenv |
| `src/utils/shopifyClient.ts` | **Stub** — throws "not implemented" |
| `src/utils/idMap.ts` | **Stub** — empty map load/save/get/set |
| `src/exporters/shopify/products.ts`, `collections.ts` | **Stubs** — log only |
| `src/importers/shopify/products.ts`, `collections.ts` | **Stubs** — log only |

## Plan Reference

See [shiftify-seed-plan.md](https://github.com/.../shiftify-seed-plan.md) (user's Downloads) and `.cursor/plans/` for full implementation plan.

**Next steps (per plan):**
1. Implement `shopifyClient` — GraphQL fetch, adaptive throttle, rate limits (100/200/1000 pts/sec)
2. Implement `idMap` — load/save `maps/id-map.json`, incremental persistence
3. Implement `exportProducts`, `exportCollections` — GraphQL queries, pagination, write to `data/`
4. Implement `importProducts`, `importCollections` — mutations, ID remapping, dependency order
5. Fill in tests (idMap, throttle, queryCost, transform)

## Commands

```bash
npm run export [-- --only products,collections]
npm run import [-- --only products,collections]
npm run typecheck
npm run check    # Biome lint + format
npm run test     # Node 18+ required
```

## Omissions (Phase 1)

- **Customers, Orders**: Deferred (PII risk) until Phase 2 ETL + PII masking.
- **Bulk Operations**: Phase 1 uses regular GraphQL; Bulk Ops for 25k+ products later.

## Architecture Note

CLI and core are separated for future UI: exporters/importers are callable modules; CLI is a thin wrapper. A future web/Electron UI can reuse the same core.
