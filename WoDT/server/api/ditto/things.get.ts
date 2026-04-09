import type { DittoThing } from '~/types/ditto'
import { dittoGet } from '~~/server/utils/ditto'

export default defineEventHandler(async () => {
  const raw = await dittoGet<DittoThing[] | Record<string, DittoThing>>('/things')
  return Array.isArray(raw) ? raw : Object.values(raw)
})