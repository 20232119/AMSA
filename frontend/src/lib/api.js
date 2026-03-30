// src/lib/api.js
const BASE = '/api'

let refreshPromise = null

async function doRefresh() {
  const rt = localStorage.getItem('refreshToken')
  if (!rt) return false
  try {
    const res  = await fetch(`${BASE}/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken: rt }),
    })
    if (!res.ok) { localStorage.clear(); return false }
    const data = await res.json()
    localStorage.setItem('accessToken',  data.accessToken)
    localStorage.setItem('refreshToken', data.refreshToken)
    return true
  } catch { localStorage.clear(); return false }
}

async function tryRefresh() {
  if (!refreshPromise) refreshPromise = doRefresh().finally(() => { refreshPromise = null })
  return refreshPromise
}

async function request(method, path, body, retry = true) {
  const token = localStorage.getItem('accessToken')
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && retry) {
    const ok = await tryRefresh()
    if (ok) return request(method, path, body, false)
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw Object.assign(new Error(err.error ?? 'Error del servidor'), { status: res.status })
  }

  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  put:    (path, body)   => request('PUT',    path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  delete: (path)         => request('DELETE', path),
}

// Download a file (for XLSX export)
export async function downloadFile(path, filename) {
  const token = localStorage.getItem('accessToken')
  const res   = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}
