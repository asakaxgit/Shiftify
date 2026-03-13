import type { Collection } from '#types/shopify'

export type CollectionRow = Record<string, string | number | boolean | undefined>

export type CollectionsSheets = { smart: CollectionRow[]; custom: CollectionRow[] }

export const collectionsToRows = (collections: Collection[]): CollectionsSheets => {
  const smart: CollectionRow[] = []
  const custom: CollectionRow[] = []

  for (const c of collections) {
    if (c.ruleSet) {
      const mustMatch = c.ruleSet.appliedDisjunctively ? 'any' : 'all'
      const rules = c.ruleSet.rules
      if (rules.length === 0) {
        smart.push({
          Handle: c.handle,
          ID: c.id,
          Title: c.title,
          'Body HTML': c.descriptionHtml ?? '',
          'Sort Order': c.sortOrder ?? 'BEST_SELLING',
          'Template Suffix': c.templateSuffix ?? '',
          'Image Src': c.image?.url ?? '',
          'Image Alt Text': c.image?.altText ?? '',
          'Must Match': mustMatch,
          'Rule: Product Column': '',
          'Rule: Relation': '',
          'Rule: Condition': '',
        })
      } else {
        for (let i = 0; i < rules.length; i++) {
          const r = rules[i]
          smart.push({
            Handle: c.handle,
            ID: i === 0 ? c.id : '',
            Title: i === 0 ? c.title : '',
            'Body HTML': i === 0 ? (c.descriptionHtml ?? '') : '',
            'Sort Order': i === 0 ? (c.sortOrder ?? 'BEST_SELLING') : '',
            'Template Suffix': i === 0 ? (c.templateSuffix ?? '') : '',
            'Image Src': i === 0 ? (c.image?.url ?? '') : '',
            'Image Alt Text': i === 0 ? (c.image?.altText ?? '') : '',
            'Must Match': i === 0 ? mustMatch : '',
            'Rule: Product Column': r.column,
            'Rule: Relation': r.relation,
            'Rule: Condition': r.condition,
          })
        }
      }
    } else {
      const handles = c.productHandles ?? []
      if (handles.length === 0) {
        custom.push({
          Handle: c.handle,
          ID: c.id,
          Title: c.title,
          'Body HTML': c.descriptionHtml ?? '',
          'Sort Order': c.sortOrder ?? 'BEST_SELLING',
          'Template Suffix': c.templateSuffix ?? '',
          'Image Src': c.image?.url ?? '',
          'Image Alt Text': c.image?.altText ?? '',
          'Product: Handle': '',
        })
      } else {
        for (let i = 0; i < handles.length; i++) {
          custom.push({
            Handle: c.handle,
            ID: i === 0 ? c.id : '',
            Title: i === 0 ? c.title : '',
            'Body HTML': i === 0 ? (c.descriptionHtml ?? '') : '',
            'Sort Order': i === 0 ? (c.sortOrder ?? 'BEST_SELLING') : '',
            'Template Suffix': i === 0 ? (c.templateSuffix ?? '') : '',
            'Image Src': i === 0 ? (c.image?.url ?? '') : '',
            'Image Alt Text': i === 0 ? (c.image?.altText ?? '') : '',
            'Product: Handle': handles[i],
          })
        }
      }
    }
  }

  return { smart, custom }
}
