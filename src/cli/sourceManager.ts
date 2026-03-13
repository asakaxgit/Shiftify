import { getCandidates as getMatrixifyCandidates } from '#adapters/matrixify/manager'
import type { Entity } from '#cli/parseEntities'
import type { SourceType } from '#utils/config'
import { config } from '#utils/config'

export type CandidateMap = Record<Entity, boolean>

/**
 * Asks the source manager for entities that can be imported/exported.
 * - matrixify-xlsx: candidates = which sheets exist in the XLSX
 * - shopify: all entities are candidates
 */
export const getCandidates = async (sourceType: SourceType): Promise<CandidateMap> => {
  if (sourceType === 'matrixify-xlsx') {
    return getMatrixifyCandidates()
  }
  return {
    products: true,
    collections: true,
    'metafield-definitions': true,
  }
}

/** Resolve the active source from config. */
export const getSource = (): SourceType => config.SOURCE_TYPE
