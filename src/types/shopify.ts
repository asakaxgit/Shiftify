// ─── Product ─────────────────────────────────────────────────────────────────

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
  weight: number
  weightUnit: string
  inventoryPolicy: string
  inventoryItem: { tracked: boolean }
  selectedOptions: Array<{ name: string; value: string }>
  position: number
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
