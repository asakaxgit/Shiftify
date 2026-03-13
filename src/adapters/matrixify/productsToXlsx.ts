import type { Product, ProductMetafield, ProductVariant } from '#types/shopify'

const fromWeightUnit = (unit: string): string => {
  const u = unit.toUpperCase()
  if (u === 'GRAMS') return 'g'
  if (u === 'KILOGRAMS') return 'kg'
  if (u === 'POUNDS') return 'lb'
  if (u === 'OUNCES') return 'oz'
  return 'kg'
}

const metafieldHeader = (m: ProductMetafield): string =>
  `Metafield: ${m.namespace}.${m.key} [${m.type}]`
const variantMetafieldHeader = (m: ProductMetafield): string =>
  `Variant Metafield: ${m.namespace}.${m.key} [${m.type}]`

export type ProductRow = Record<string, string | number | boolean | undefined>

export const productsToRows = (products: Product[]): ProductRow[] => {
  const rows: ProductRow[] = []
  const productMetafieldHeaders = new Map<string, string>()
  const variantMetafieldHeaders = new Map<string, string>()

  const getVariants = (p: Product): ProductVariant[] => {
    const v = (p as { variants?: ProductVariant[] | { nodes?: ProductVariant[] } }).variants
    if (!v) return []
    return Array.isArray(v) ? v : (v.nodes ?? [])
  }
  const getImages = (
    p: Product,
  ): { url?: string; altText?: string | null; width?: number; height?: number }[] => {
    const img = (p as { images?: unknown[] | { nodes?: unknown[] } }).images
    if (!img) return []
    return Array.isArray(img)
      ? (img as { url?: string; altText?: string | null; width?: number; height?: number }[])
      : ((img.nodes ?? []) as {
          url?: string
          altText?: string | null
          width?: number
          height?: number
        }[])
  }
  const getMetafields = (owner: {
    metafields?: ProductMetafield[] | { nodes?: ProductMetafield[] }
  }): ProductMetafield[] => {
    const m = owner.metafields
    if (!m) return []
    return Array.isArray(m) ? m : (m.nodes ?? [])
  }
  const getTags = (p: Product): string[] => {
    const t = (p as { tags?: string[] }).tags
    if (!t) return []
    return Array.isArray(t) ? t : []
  }

  for (const product of products) {
    for (const m of getMetafields(product)) {
      const key = `${m.namespace}.${m.key}`
      if (!productMetafieldHeaders.has(key)) productMetafieldHeaders.set(key, metafieldHeader(m))
    }
    for (const v of getVariants(product)) {
      for (const m of getMetafields(v)) {
        const key = `${m.namespace}.${m.key}`
        if (!variantMetafieldHeaders.has(key))
          variantMetafieldHeaders.set(key, variantMetafieldHeader(m))
      }
    }
  }

  const fixedKeys = [
    'Handle',
    'Title',
    'Body HTML',
    'Type',
    'Vendor',
    'Status',
    'Tags',
    'Option1 Name',
    'Option1 Value',
    'Option2 Name',
    'Option2 Value',
    'Option3 Name',
    'Option3 Value',
    'Variant SKU',
    'Variant Barcode',
    'Variant Price',
    'Variant Compare At Price',
    'Variant Inventory Policy',
    'Variant Inventory Tracker',
    'Variant Weight',
    'Variant Weight Unit',
    'Image Src',
    'Image Alt Text',
    'Image Position',
    'Image Width',
    'Image Height',
  ] as const

  for (const product of products) {
    const productMetafieldValues = new Map<string, string>()
    for (const m of getMetafields(product)) {
      const key = `${m.namespace}.${m.key}`
      productMetafieldValues.set(key, m.value)
    }
    const images = getImages(product)
    const firstImage = images[0]
    const variants = getVariants(product)

    for (let i = 0; i < variants.length; i++) {
      const v = variants[i] as ProductVariant
      const opt1 = v.selectedOptions[0]
      const opt2 = v.selectedOptions[1]
      const opt3 = v.selectedOptions[2]
      const weight = v.inventoryItem?.measurement?.weight
      const row: ProductRow = {
        Handle: product.handle,
        Title: product.title,
        'Body HTML': product.descriptionHtml ?? '',
        Type: product.productType ?? '',
        Vendor: product.vendor ?? '',
        Status: product.status ?? 'ACTIVE',
        Tags: getTags(product).join(', '),
        'Option1 Name': opt1?.name ?? '',
        'Option1 Value': opt1?.value ?? '',
        'Option2 Name': opt2?.name ?? '',
        'Option2 Value': opt2?.value ?? '',
        'Option3 Name': opt3?.name ?? '',
        'Option3 Value': opt3?.value ?? '',
        'Variant SKU': v.sku ?? '',
        'Variant Barcode': v.barcode ?? '',
        'Variant Price': v.price ?? '0.00',
        'Variant Compare At Price': v.compareAtPrice ?? '',
        'Variant Inventory Policy': v.inventoryPolicy ?? 'deny',
        'Variant Inventory Tracker': v.inventoryItem?.tracked ? 'shopify' : '',
        'Variant Weight': weight?.value ?? 0,
        'Variant Weight Unit': weight?.unit ? fromWeightUnit(weight.unit) : 'kg',
        'Image Src': firstImage?.url ?? '',
        'Image Alt Text': firstImage?.altText ?? '',
        'Image Position': i === 0 ? 1 : '',
        'Image Width': firstImage?.width ?? 0,
        'Image Height': firstImage?.height ?? 0,
      }
      for (const [key, header] of productMetafieldHeaders) {
        row[header] = productMetafieldValues.get(key) ?? ''
      }
      for (const m of getMetafields(v)) {
        const header = variantMetafieldHeaders.get(`${m.namespace}.${m.key}`)
        if (header) row[header] = m.value
      }
      rows.push(row)
    }

    if (variants.length === 0) {
      const row: ProductRow = {
        Handle: product.handle,
        Title: product.title,
        'Body HTML': product.descriptionHtml ?? '',
        Type: product.productType ?? '',
        Vendor: product.vendor ?? '',
        Status: product.status ?? 'ACTIVE',
        Tags: getTags(product).join(', '),
        'Option1 Name': '',
        'Option1 Value': '',
        'Option2 Name': '',
        'Option2 Value': '',
        'Option3 Name': '',
        'Option3 Value': '',
        'Variant SKU': '',
        'Variant Barcode': '',
        'Variant Price': '0.00',
        'Variant Compare At Price': '',
        'Variant Inventory Policy': 'deny',
        'Variant Inventory Tracker': '',
        'Variant Weight': 0,
        'Variant Weight Unit': 'kg',
        'Image Src': firstImage?.url ?? '',
        'Image Alt Text': firstImage?.altText ?? '',
        'Image Position': 1,
        'Image Width': firstImage?.width ?? 0,
        'Image Height': firstImage?.height ?? 0,
      }
      for (const [key, header] of productMetafieldHeaders) {
        row[header] = productMetafieldValues.get(key) ?? ''
      }
      rows.push(row)
    }
  }

  return rows
}
