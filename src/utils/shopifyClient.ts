import { config } from './config.js'
import { logger } from './logger.js'

// Shopify leaky-bucket defaults per plan
const PLAN_BUCKETS = {
  plus: { maximum: 2000, restoreRate: 100 },
  standard: { maximum: 1000, restoreRate: 50 },
} as const

interface ThrottleStatus {
  maximumAvailable: number
  currentlyAvailable: number
  restoreRate: number
}

interface QueryCost {
  requestedQueryCost: number
  actualQueryCost: number | null
  throttleStatus: ThrottleStatus
}

interface GraphQLResponse<T = unknown> {
  data?: T
  errors?: Array<{ message: string; locations?: unknown[]; path?: unknown[] }>
  extensions?: { cost?: QueryCost }
}

interface BucketState {
  available: number
  maximum: number
  restoreRate: number
  updatedAt: number
}

// Per-shop bucket state shared across calls
const buckets = new Map<string, BucketState>()

function getToken(shop: string): string {
  if (shop === config.PROD_SHOP) return config.PROD_ACCESS_TOKEN
  if (shop === config.DEV_SHOP) return config.DEV_ACCESS_TOKEN
  throw new Error(`Unknown shop: ${shop}`)
}

function getBucket(shop: string): BucketState {
  let bucket = buckets.get(shop)
  if (!bucket) {
    const plan = config.SHOPIFY_PLAN === 'plus' ? 'plus' : 'standard'
    const defaults = PLAN_BUCKETS[plan]
    bucket = {
      available: defaults.maximum,
      maximum: defaults.maximum,
      restoreRate: defaults.restoreRate,
      updatedAt: Date.now(),
    }
    buckets.set(shop, bucket)
  }
  return bucket
}

function projectAvailable(bucket: BucketState): number {
  const elapsedSec = (Date.now() - bucket.updatedAt) / 1000
  return Math.min(bucket.maximum, bucket.available + elapsedSec * bucket.restoreRate)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const MAX_RETRIES = 3
// Wait if bucket is projected below this fraction of max before sending
const LOW_WATER_FRACTION = 0.1

export const shopifyClient = {
  async graphql<T = unknown>(
    shop: string,
    query: string,
    vars?: Record<string, unknown>,
  ): Promise<T> {
    const token = getToken(shop)
    const url = `https://${shop}/admin/api/${config.API_VERSION}/graphql.json`
    const bucket = getBucket(shop)

    // Pre-request adaptive wait: hold off if bucket is nearly empty
    const projected = projectAvailable(bucket)
    const lowWater = bucket.maximum * LOW_WATER_FRACTION
    if (projected < lowWater) {
      const waitMs = ((lowWater - projected) / bucket.restoreRate) * 1000
      logger.warn(
        `[throttle] ${shop} bucket low (${projected.toFixed(0)}/${bucket.maximum}), waiting ${(waitMs / 1000).toFixed(1)}s`,
      )
      await sleep(waitMs)
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ query, variables: vars }),
      })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get('Retry-After') ?? 2)
        logger.warn(
          `[throttle] ${shop} 429 rate limited, retrying in ${retryAfter}s (attempt ${attempt}/${MAX_RETRIES})`,
        )
        if (attempt === MAX_RETRIES) throw new Error(`Shopify 429 after ${MAX_RETRIES} retries on ${shop}`)
        await sleep(retryAfter * 1000)
        continue
      }

      if (!res.ok) {
        throw new Error(`Shopify HTTP ${res.status} on ${shop}: ${await res.text()}`)
      }

      const json: GraphQLResponse<T> = await res.json()

      // Update per-shop bucket from response cost metadata
      const cost = json.extensions?.cost
      if (cost) {
        bucket.available = cost.throttleStatus.currentlyAvailable
        bucket.maximum = cost.throttleStatus.maximumAvailable
        bucket.restoreRate = cost.throttleStatus.restoreRate
        bucket.updatedAt = Date.now()
      }

      if (json.errors?.length) {
        const msgs = json.errors.map(e => e.message).join('; ')
        throw new Error(`Shopify GraphQL error on ${shop}: ${msgs}`)
      }

      if (json.data === undefined) {
        throw new Error(`Shopify returned no data from ${shop}`)
      }

      return json.data
    }

    // Unreachable: loop always returns or throws
    throw new Error('shopifyClient.graphql: exceeded retries')
  },
}
