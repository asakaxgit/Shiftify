import minimist from 'minimist'
import { logger } from '#utils/logger'

export type Entity = 'products' | 'collections' | 'metafield-definitions'
export const VALID_ENTITIES: readonly Entity[] = [
  'products',
  'collections',
  'metafield-definitions',
]
const VALID_SET = new Set<string>(VALID_ENTITIES)

const getArgv = () => minimist(process.argv.slice(2))

export const getDryRun = (): boolean => {
  const argv = getArgv()
  return argv['dry-run'] === true || argv.n === true
}

export const parseEntities = (): Entity[] => {
  const argv = getArgv()

  const rawOnly: string | string[] = argv.only ?? argv.o ?? []
  const only = [rawOnly].flat().filter(Boolean)

  const rawSkip: string | string[] = argv.skip ?? argv.s ?? []
  const skip = [rawSkip].flat().filter(Boolean)

  if (only.length && skip.length) {
    logger.error('--only and --skip cannot be used together')
    process.exit(1)
  }

  if (skip.length) {
    const invalid = skip.filter((e) => !VALID_SET.has(e))
    if (invalid.length) {
      logger.error(`Invalid --skip: ${invalid.join(', ')}. Valid: ${VALID_ENTITIES.join(', ')}`)
      process.exit(1)
    }
    return VALID_ENTITIES.filter((e) => !skip.includes(e))
  }

  if (!only.length) return [...VALID_ENTITIES]
  const invalid = only.filter((e) => !VALID_SET.has(e))
  if (invalid.length) {
    logger.error(`Invalid --only: ${invalid.join(', ')}. Valid: ${VALID_ENTITIES.join(', ')}`)
    process.exit(1)
  }
  return only.filter((e): e is Entity => VALID_SET.has(e))
}
