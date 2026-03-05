import path from 'node:path'
import fs from 'fs-extra'
import pLimit from 'p-limit'
import { MetafieldDefinitionCreateDocument, MetafieldOwnerType } from '#gql/graphql'
import type { MetafieldDefinition } from '#types/shopify'
import { config } from '#utils/config'
import { logger } from '#utils/logger'
import { shopifyClient } from '#utils/shopifyClient'

const VALID_OWNER_TYPES: readonly string[] = Object.values(MetafieldOwnerType)
const isMetafieldOwnerType = (s: string): s is MetafieldOwnerType => VALID_OWNER_TYPES.includes(s)

export const importMetafieldDefinitions = async (): Promise<void> => {
  const shop = config.DEST_SHOP
  const dataPath = path.join(config.DATA_DIR, 'metafield-definitions.json')
  const definitions: MetafieldDefinition[] = await fs.readJson(dataPath)
  logger.info(`Importing ${definitions.length} metafield definitions to ${shop}...`)

  const limit = pLimit(config.CONCURRENCY)
  let done = 0
  let errors = 0

  await Promise.all(
    definitions.map((def) =>
      limit(async () => {
        try {
          if (!isMetafieldOwnerType(def.ownerType)) {
            logger.warn(
              `  [skip] invalid ownerType "${def.ownerType}" for ${def.namespace}.${def.key}`,
            )
            errors++
            return
          }
          const result = await shopifyClient.graphql(shop, MetafieldDefinitionCreateDocument, {
            definition: {
              name: def.name,
              namespace: def.namespace,
              key: def.key,
              description: def.description,
              type: def.type,
              ownerType: def.ownerType,
              pin: def.pinnedPosition !== null,
              validations: def.validations.map((v) => ({ name: v.name, value: v.value ?? '' })),
            },
          })
          const { userErrors } = result.metafieldDefinitionCreate ?? { userErrors: [] }
          if (userErrors.length) {
            logger.warn(
              `  [skip] ${def.ownerType} ${def.namespace}.${def.key}: ${userErrors[0].message}`,
            )
            errors++
          }
        } catch (err) {
          logger.error(`  [error] ${def.ownerType} ${def.namespace}.${def.key}: ${String(err)}`)
          errors++
        } finally {
          done++
          if (done % 50 === 0 || done === definitions.length) {
            logger.info(`  ${done}/${definitions.length} metafield definitions processed`)
          }
        }
      }),
    ),
  )

  logger.success(
    `Imported ${definitions.length - errors}/${definitions.length} metafield definitions (${errors} errors)`,
  )
}
