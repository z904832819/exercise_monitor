const TOKEN_STORAGE_KEY = 'fitagent_token'

function getAppInstance() {
  return getApp()
}

function trimValue(value) {
  return value == null ? '' : String(value).trim()
}

function getToken() {
  const app = getAppInstance()
  const appToken = app && app.globalData && app.globalData.token
  if (appToken) {
    return String(appToken)
  }

  const cachedToken = wx.getStorageSync(TOKEN_STORAGE_KEY)
  if (cachedToken) {
    app.globalData.token = String(cachedToken)
    return String(cachedToken)
  }

  return ''
}

function getBaseUrl() {
  const app = getAppInstance()
  const configured = app && app.globalData ? app.globalData.baseApiUrl : ''
  const baseUrl = trimValue(configured || 'http://127.0.0.1:8787')
  return baseUrl.replace(/\/$/, '')
}

function buildQuery(url, query) {
  if (!query || typeof query !== 'object') return url
  const pairs = Object.entries(query)
    .map(([key, value]) => [key, trimValue(value)])
    .filter(([, value]) => value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)

  if (!pairs.length) return url
  return `${url}${url.includes('?') ? '&' : '?'}${pairs.join('&')}`
}

function buildUrl(url, query) {
  const base = getBaseUrl()
  const cleanUrl = trimValue(url)
  const withQuery = buildQuery(cleanUrl, query)
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(withQuery)) return withQuery
  return `${base}${withQuery.startsWith('/') ? '' : '/'}${withQuery}`
}

function parseData(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }

  return raw
}

function extractErrorMessage(payload, statusCode) {
  if (payload && typeof payload === 'object') {
    if (typeof payload.error === 'string') return payload.error
    if (typeof payload.message === 'string') return payload.message
  }

  if (statusCode >= 500) return `服务暂不可用（${statusCode}）`
  if (statusCode >= 400) return `请求失败（${statusCode}）`
  return '请求失败'
}

function requestJson({ url, method = 'GET', data, query, requireAuth = true, headers = {} }) {
  const app = getAppInstance()
  return new Promise((resolve, reject) => {
    const token = requireAuth ? getToken() : ''
    const requestHeaders = {
      ...headers,
    }

    if (token) {
      requestHeaders.Authorization = `Bearer ${token}`
    }

    if (method !== 'GET' && !requestHeaders['content-type']) {
      requestHeaders['content-type'] = 'application/json'
    }

    wx.request({
      url: buildUrl(url, query),
      method,
      data,
      header: requestHeaders,
      success: (response) => {
        const statusCode = response.statusCode || 0
        const parsed = parseData(response.data)
        if (statusCode >= 200 && statusCode < 300) {
          if (parsed && typeof parsed === 'object' && parsed.ok === false) {
            reject(new Error(extractErrorMessage(parsed, statusCode)))
            return
          }

          resolve(parsed)
          return
        }

        if (statusCode === 401) {
          app.clearSession()
          reject(new Error('登录已失效，请重新登录'))
          return
        }

        reject(new Error(extractErrorMessage(parsed, statusCode)))
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '请求失败'))
      },
    })
  })
}

function uploadFile({ url, filePath, name = 'file', formData = {}, requireAuth = true, query }) {
  const app = getAppInstance()
  return new Promise((resolve, reject) => {
    const token = requireAuth ? getToken() : ''
    const headers = {}
    if (token) headers.Authorization = `Bearer ${token}`

    wx.uploadFile({
      url: buildUrl(url, query),
      filePath,
      name,
      formData,
      header: headers,
      success: (response) => {
        const statusCode = response.statusCode || 0
        const parsed = parseData(response.data)
        if (statusCode >= 200 && statusCode < 300) {
          if (parsed && typeof parsed === 'object' && parsed.ok === false) {
            reject(new Error(extractErrorMessage(parsed, statusCode)))
            return
          }
          resolve(parsed)
          return
        }

        if (statusCode === 401) {
          app.clearSession()
          reject(new Error('登录已失效，请重新登录'))
          return
        }

        reject(new Error(extractErrorMessage(parsed, statusCode)))
      },
      fail: (error) => {
        reject(new Error(error.errMsg || '上传失败'))
      },
    })
  })
}

module.exports = {
  buildUrl,
  requestJson,
  uploadFile,
  get: (url, query = undefined) => requestJson({ url, method: 'GET', query }),
  post: (url, data = {}, query = undefined) => requestJson({ url, method: 'POST', data, query }),
  patch: (url, data = {}, query = undefined) => requestJson({ url, method: 'PATCH', data, query }),
  del: (url, query = undefined) => requestJson({ url, method: 'DELETE', query }),
}
