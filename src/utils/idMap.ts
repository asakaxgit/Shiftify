const emptyMap = { products: {}, variants: {}, collections: {} }

export const idMap = {
  load: () => emptyMap,
  save: (_map: typeof emptyMap) => {},
  get: (_entity: keyof typeof emptyMap, _id: string): string | undefined => undefined,
  set: (_entity: keyof typeof emptyMap, _srcId: string, _dstId: string) => {},
}
