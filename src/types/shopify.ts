// ─── Product ─────────────────────────────────────────────────────────────────

export type ProductMetafield = { namespace: string; key: string; type: string; value: string }

export interface ProductImage {
  id: string
  url: string
  altText: string | null
  width: number
  height: number
}

export interface ProductVariant {
  id: string
  title: string
  sku: string | null
  barcode: string | null
  price: string
  compareAtPrice: string | null
  inventoryPolicy: string
  inventoryItem: {
    tracked: boolean
    measurement: { weight: { unit: string; value: number } | null }
  }
  selectedOptions: Array<{ name: string; value: string }>
  position: number
  metafields?: ProductMetafield[]
}

export interface ProductOption {
  name: string
  values: string[]
}

export interface Product {
  id: string
  title: string
  handle: string
  descriptionHtml: string
  productType: string
  vendor: string
  status: string
  tags: string[]
  options: ProductOption[]
  variants: { nodes: ProductVariant[] }
  images: { nodes: ProductImage[] }
  metafields?: ProductMetafield[]
}

// ─── MetafieldDefinition ──────────────────────────────────────────────────────

export type MetafieldDefinitionValidation = {
  name: string
  type: string
  value: string | null
}

export type MetafieldDefinition = {
  name: string
  namespace: string
  key: string
  description: string | null
  type: string
  ownerType: string
  pinnedPosition: number | null
  validations: MetafieldDefinitionValidation[]
}

// ─── Collection ───────────────────────────────────────────────────────────────

export interface CollectionRule {
  column: string
  relation: string
  condition: string
}

export interface CollectionRuleSet {
  appliedDisjunctively: boolean
  rules: CollectionRule[]
}

export interface CollectionImage {
  url: string
  altText: string | null
}

export interface Collection {
  id: string
  title: string
  handle: string
  descriptionHtml: string
  sortOrder: string
  templateSuffix: string | null
  image: CollectionImage | null
  ruleSet: CollectionRuleSet | null
  /** Populated for manual collections (ruleSet === null) */
  productHandles?: string[]
}
