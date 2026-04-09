import type { H3Event } from 'h3'

export const getDittoConfig = () => {
  const config = useRuntimeConfig()

  const baseUrl = String(config.dittoBaseUrl || '').trim()
  const username = String(config.dittoUsername || '').trim()
  const password = String(config.dittoPassword || '').trim()

  if (!baseUrl) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing DITTO_BASE_URL'
    })
  }

  if (!username || !password) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Missing DITTO_USERNAME or DITTO_PASSWORD'
    })
  }

  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DITTO_BASE_URL must start with http:// or https://'
    })
  }

  return { baseUrl, username, password }
}

export const getDittoAuthHeader = () => {
  const { username, password } = getDittoConfig()
  const credentials = Buffer.from(`${username}:${password}`).toString('base64')
  return `Basic ${credentials}`
}

// Hàm dùng chung để tạo headers
const getStandardHeaders = () => {
  return {
    Authorization: getDittoAuthHeader(),
    Accept: 'application/json',
    'Content-Type': 'application/json'
  }
}

// --- CÁC HÀM TƯƠNG TÁC VỚI DITTO API ---

export const dittoGet = async <T>(endpoint: string): Promise<T> => {
  const { baseUrl } = getDittoConfig()
  return await $fetch<T>(`/api/2${endpoint}`, {
    method: 'GET',
    baseURL: baseUrl,
    headers: getStandardHeaders()
  }) as T
}

export const dittoPost = async <T>(endpoint: string, body: any): Promise<T> => {
  const { baseUrl } = getDittoConfig()
  return await $fetch<T>(`/api/2${endpoint}`, {
    method: 'POST',
    baseURL: baseUrl,
    headers: getStandardHeaders(),
    body
  }) as T
}

export const dittoPut = async <T>(endpoint: string, body: any): Promise<T> => {
  const { baseUrl } = getDittoConfig()
  return await $fetch<T>(`/api/2${endpoint}`, {
    method: 'PUT',
    baseURL: baseUrl,
    headers: getStandardHeaders(),
    body
  }) as T
}

export const dittoPatch = async <T>(endpoint: string, body: any): Promise<T> => {
  const { baseUrl } = getDittoConfig()
  return await $fetch<T>(`/api/2${endpoint}`, {
    method: 'PATCH',
    baseURL: baseUrl,
    headers: getStandardHeaders(),
    body
  }) as T
}

export const dittoDelete = async <T>(endpoint: string): Promise<T> => {
  const { baseUrl } = getDittoConfig()
  return await $fetch<T>(`/api/2${endpoint}`, {
    method: 'DELETE',
    baseURL: baseUrl,
    headers: getStandardHeaders()
  }) as T
}