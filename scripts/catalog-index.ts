import { z } from 'zod'

const indexSchema = z.object({
  catalogYear: z.string().regex(/^\d{4}-\d{4}$/), catalogId: z.string().regex(/^\d+$/),
  retrievedOn: z.iso.date(), sourceUrl: z.url(),
  observedResultCount: z.number().int().positive(), observedPaginationLinkCount: z.number().int().nonnegative(),
  courseCodes: z.array(z.string().regex(/^CS \d{4}$/)).min(1),
})

export function parseCatalogIndex(value: unknown, year: string, catalogId: string) {
  const index = indexSchema.parse(value)
  const url = new URL(index.sourceUrl)
  if (index.catalogYear !== year || index.catalogId !== catalogId || url.protocol !== 'https:' ||
      url.hostname !== 'catalog.uhd.edu' || (url.searchParams.get('catoid') ?? url.searchParams.get('cur_cat_oid')) !== catalogId)
    throw new Error('Catalog index edition mismatch')
  if (new Set(index.courseCodes).size !== index.courseCodes.length || index.observedResultCount !== index.courseCodes.length)
    throw new Error('Catalog index count mismatch')
  return index
}
