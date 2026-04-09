// server/api/ditto/things/[id]/stream.ts
import { getDittoConfig, getDittoAuthHeader } from '~~/server/utils/ditto'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing thing id' })
  }

  const { baseUrl } = getDittoConfig()
  const authHeader = getDittoAuthHeader()

  // Eclipse Ditto trả về luồng Real-time (SSE) khi bạn gọi API HTTP với header Accept đặc biệt này
  const response = await fetch(`${baseUrl}/api/2/things?ids=${encodeURIComponent(id)}`, {
    headers: {
      'Authorization': authHeader,
      'Accept': 'text/event-stream'
    }
  })

  // Set các header chuẩn để báo cho trình duyệt biết đây là một luồng Stream không bao giờ ngắt
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')

  // Nuxt 3 hỗ trợ đẩy thẳng ReadableStream từ fetch trả về cho client
  return response.body
})