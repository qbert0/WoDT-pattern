import { getSystemActions } from '~~/server/utils/system'

export default defineEventHandler(async () => {
  return getSystemActions()
})
