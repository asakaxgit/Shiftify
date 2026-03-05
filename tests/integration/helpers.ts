import pLimit from 'p-limit'
import { shopifyClient } from '#utils/shopifyClient'

// ─── Safety gate ─────────────────────────────────────────────────────────────

const assertSafeToTruncate = (shop: string): void => {
  const allowed = process.env.INTEGRATION_TEST_SHOP
  if (!allowed || allowed !== shop) {
    throw new Error(
      `truncateShop: INTEGRATION_TEST_SHOP ("${allowed ?? ''}") does not match shop "${shop}" — aborting to prevent data loss`,
    )
  }
  const pattern = process.env.SAFE_SHOP_PATTERN ?? 'dev'
  if (!shop.includes(pattern)) {
    throw new Error(
      `truncateShop: shop "${shop}" does not look like a dev store (SAFE_SHOP_PATTERN: "${pattern}")`,
    )
  }
}

// ─── Truncate ─────────────────────────────────────────────────────────────────

const deleteAll = async (
  shop: string,
  query: string,
  extractIds: (data: unknown) => { ids: string[]; hasNextPage: boolean; endCursor: string | null },
  deleteMutation: string,
  deletionResultKey: string,
): Promise<void> => {
  const limit = pLimit(5)
  let cursor: string | null = null

  do {
    const data = await shopifyClient.graphql(shop, query, cursor ? { cursor } : {})
    const { ids, hasNextPage, endCursor } = extractIds(data)
    await Promise.all(ids.map((id) => limit(() => shopifyClient.graphql(shop, deleteMutation, { id }))))
    cursor = hasNextPage ? endCursor : null
  } while (cursor)
}

export const truncateShop = async (shop: string): Promise<void> => {
  assertSafeToTruncate(shop)

  // Delete collections first (no dependency on products)
  await deleteAll(
    shop,
    `query($cursor: String) {
      collections(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id }
      }
    }`,
    (data) => {
      const d = data as { collections: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { id: string }[] } }
      return {
        ids: d.collections.nodes.map((n) => n.id),
        hasNextPage: d.collections.pageInfo.hasNextPage,
        endCursor: d.collections.pageInfo.endCursor,
      }
    },
    `mutation($id: ID!) { collectionDelete(input: { id: $id }) { deletedCollectionId } }`,
    'collectionDelete',
  )

  // Delete products
  await deleteAll(
    shop,
    `query($cursor: String) {
      products(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes { id }
      }
    }`,
    (data) => {
      const d = data as { products: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: { id: string }[] } }
      return {
        ids: d.products.nodes.map((n) => n.id),
        hasNextPage: d.products.pageInfo.hasNextPage,
        endCursor: d.products.pageInfo.endCursor,
      }
    },
    `mutation($id: ID!) { productDelete(input: { id: $id }) { deletedProductId } }`,
    'productDelete',
  )
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

type SeededItem = { id: string; handle: string }

const productSetMutation = `
  mutation($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product { id handle }
      userErrors { field message }
    }
  }
`

const createProduct = async (shop: string, input: Record<string, unknown>): Promise<SeededItem> => {
  const result = await shopifyClient.graphql(shop, productSetMutation, { input })
  const r = result as { productSet: { product: SeededItem | null; userErrors: { message: string }[] } }
  if (r.productSet.userErrors.length) {
    throw new Error(`seedProducts: ${r.productSet.userErrors.map((e) => e.message).join('; ')}`)
  }
  if (!r.productSet.product) throw new Error('seedProducts: productSet returned no product')
  return r.productSet.product
}

export const seedProducts = async (shop: string, prefix: string): Promise<SeededItem[]> => {
  const tshirt = await createProduct(shop, {
    title: `${prefix} T-Shirt`,
    handle: `${prefix}-tshirt`,
    productType: 'T-Shirt',
    status: 'ACTIVE',
    productOptions: [
      { name: 'Color', values: [{ name: 'Red' }, { name: 'Blue' }] },
      { name: 'Size', values: [{ name: 'S' }, { name: 'M' }] },
    ],
    variants: [
      { optionValues: [{ optionName: 'Color', name: 'Red' }, { optionName: 'Size', name: 'S' }], price: '29.99', sku: `${prefix}-ts-rs` },
      { optionValues: [{ optionName: 'Color', name: 'Red' }, { optionName: 'Size', name: 'M' }], price: '29.99', sku: `${prefix}-ts-rm` },
      { optionValues: [{ optionName: 'Color', name: 'Blue' }, { optionName: 'Size', name: 'S' }], price: '29.99', sku: `${prefix}-ts-bs` },
      { optionValues: [{ optionName: 'Color', name: 'Blue' }, { optionName: 'Size', name: 'M' }], price: '29.99', sku: `${prefix}-ts-bm` },
    ],
  })

  const mug = await createProduct(shop, {
    title: `${prefix} Mug`,
    handle: `${prefix}-mug`,
    productType: 'Mug',
    status: 'ACTIVE',
    productOptions: [{ name: 'Title', values: [{ name: 'Default Title' }] }],
    variants: [{ price: '14.99', sku: `${prefix}-mug-default`, optionValues: [{ optionName: 'Title', name: 'Default Title' }] }],
  })

  const hat = await createProduct(shop, {
    title: `${prefix} Hat`,
    handle: `${prefix}-hat`,
    productType: 'Hat',
    status: 'ACTIVE',
    productOptions: [{ name: 'Color', values: [{ name: 'Black' }, { name: 'White' }] }],
    variants: [
      { optionValues: [{ optionName: 'Color', name: 'Black' }], price: '24.99', sku: `${prefix}-hat-black` },
      { optionValues: [{ optionName: 'Color', name: 'White' }], price: '24.99', sku: `${prefix}-hat-white` },
    ],
  })

  return [tshirt, mug, hat]
}

export const seedCollections = async (
  shop: string,
  prefix: string,
  products: SeededItem[],
): Promise<SeededItem[]> => {
  const createMutation = `
    mutation($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id handle }
        userErrors { field message }
      }
    }
  `
  const addProductsMutation = `
    mutation($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection { id }
        userErrors { message }
      }
    }
  `

  const createCol = async (input: Record<string, unknown>): Promise<SeededItem> => {
    const result = await shopifyClient.graphql(shop, createMutation, { input })
    const r = result as {
      collectionCreate: { collection: SeededItem | null; userErrors: { message: string }[] }
    }
    if (r.collectionCreate.userErrors.length) {
      throw new Error(`seedCollections: ${r.collectionCreate.userErrors.map((e) => e.message).join('; ')}`)
    }
    if (!r.collectionCreate.collection) throw new Error('seedCollections: collectionCreate returned no collection')
    return r.collectionCreate.collection
  }

  const smart = await createCol({
    title: `${prefix} Smart`,
    handle: `${prefix}-smart`,
    ruleSet: {
      appliedDisjunctively: false,
      rules: [{ column: 'TYPE', relation: 'EQUALS', condition: 'T-Shirt' }],
    },
  })

  const manual = await createCol({
    title: `${prefix} Manual`,
    handle: `${prefix}-manual`,
  })

  // Add t-shirt and mug to the manual collection
  const tshirt = products.find((p) => p.handle.endsWith('-tshirt'))
  const mug = products.find((p) => p.handle.endsWith('-mug'))
  if (tshirt && mug) {
    await shopifyClient.graphql(shop, addProductsMutation, {
      id: manual.id,
      productIds: [tshirt.id, mug.id],
    })
  }

  return [smart, manual]
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export type ProductSummary = {
  id: string
  handle: string
  title: string
  options: Array<{ name: string; values: string[] }>
  variants: Array<{ sku: string | null; price: string; selectedOptions: Array<{ name: string; value: string }> }>
}

export const queryProducts = async (shop: string, handlePrefix: string): Promise<ProductSummary[]> => {
  const result = await shopifyClient.graphql(shop, `
    query($query: String!) {
      products(first: 10, query: $query) {
        nodes {
          id handle title
          options { name values }
          variants(first: 20) {
            nodes {
              sku price
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `, { query: `handle:${handlePrefix}*` })

  const r = result as {
    products: {
      nodes: Array<{
        id: string; handle: string; title: string
        options: Array<{ name: string; values: string[] }>
        variants: { nodes: Array<{ sku: string | null; price: string; selectedOptions: Array<{ name: string; value: string }> }> }
      }>
    }
  }

  return r.products.nodes.map((p) => ({
    id: p.id,
    handle: p.handle,
    title: p.title,
    options: p.options,
    variants: p.variants.nodes,
  }))
}

export type CollectionSummary = {
  id: string
  handle: string
  title: string
  ruleSet: unknown
  productHandles: string[]
}

export const queryCollections = async (shop: string, handlePrefix: string): Promise<CollectionSummary[]> => {
  const allNodes: Array<{
    id: string
    handle: string
    title: string
    ruleSet: unknown
    products: { nodes: Array<{ handle: string }> }
  }> = []
  let cursor: string | null = null

  do {
    const result = await shopifyClient.graphql(
      shop,
      `
    query($cursor: String) {
      collections(first: 250, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id handle title
          ruleSet { appliedDisjunctively rules { column relation condition } }
          products(first: 50) { nodes { handle } }
        }
      }
    }
  `,
      cursor ? { cursor } : {},
    )
    const r = result as {
      collections: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null }
        nodes: Array<{
          id: string
          handle: string
          title: string
          ruleSet: unknown
          products: { nodes: Array<{ handle: string }> }
        }>
      }
    }
    for (const node of r.collections.nodes) {
      if (node.handle.startsWith(handlePrefix)) allNodes.push(node)
    }
    cursor = r.collections.pageInfo.hasNextPage ? r.collections.pageInfo.endCursor : null
  } while (cursor)

  return allNodes.map((c) => ({
    id: c.id,
    handle: c.handle,
    title: c.title,
    ruleSet: c.ruleSet,
    productHandles: c.products.nodes.map((p) => p.handle),
  }))
}
