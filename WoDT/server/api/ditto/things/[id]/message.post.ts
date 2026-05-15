import { dittoPost } from '~~/server/utils/ditto'

export default defineEventHandler(async (event) => {
  // 1. Lấy toàn bộ tham số từ URL
  const thingId = getRouterParam(event, 'thingId')
  const featureId = getRouterParam(event, 'featureId')
  const subject = getRouterParam(event, 'subject')

  if (!thingId || !featureId || !subject) {
    throw createError({ 
      statusCode: 400, 
      statusMessage: 'Thiếu thingId, featureId hoặc subject' 
    })
  }

  // 2. Đọc payload và query parameters (timeout, requested-acks, condition)
  const payload = await readBody(event)
  const query = getQuery(event)

  // 3. Xây dựng chuỗi query string truyền xuống Ditto
  const queryParams = new URLSearchParams()
  if (query.timeout !== undefined) queryParams.append('timeout', String(query.timeout))
  if (query['requested-acks']) queryParams.append('requested-acks', String(query['requested-acks']))
  if (query.condition) queryParams.append('condition', String(query.condition))

  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ''

  try {
    // 4. Gọi Eclipse Ditto API chuẩn:
    // POST /api/2/things/{thingId}/features/{featureId}/inbox/messages/{subject}
    const endpoint = `/things/${thingId}/features/${featureId}/inbox/messages/${subject}${queryString}`
    
    const response = await dittoPost(endpoint, payload)
    
    // Ditto thường trả về 204 No Content cho Fire-and-forget (timeout=0)
    return response || { success: true, message: 'Đã gửi lệnh thành công' }
  } catch (error: any) {
    console.error(`Lỗi Ditto Message (${subject}):`, error)
    throw createError({ 
      statusCode: error?.statusCode || 500, 
      statusMessage: error?.statusMessage || 'Lỗi khi gửi lệnh xuống thiết bị' 
    })
  }
})