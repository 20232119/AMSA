// src/lib/webauthn.js
import { startAuthentication, startRegistration } from '@simplewebauthn/browser'

const BASE = '/api'
const CACHE_TTL_MS = 60_000

function getToken() {
  return localStorage.getItem('accessToken') ?? ''
}

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.error ?? `HTTP ${res.status}`), {
      status: res.status,
    })
  }

  return res.json()
}

let _cache = null
let _warmPromise = null

function normalizeOptions(data) {
  const { userId, ...optionsJSON } = data

  if (Array.isArray(optionsJSON.allowCredentials)) {
    optionsJSON.allowCredentials = optionsJSON.allowCredentials.map((c) => ({
      ...c,
      type: 'public-key',
    }))
  }

  return { userId, optionsJSON }
}

function isCacheValid(identifier) {
  if (!_cache) return false
  if (_cache.identifier !== identifier) return false
  if (!_cache.optionsJSON?.challenge) return false
  if (Date.now() - _cache.fetchedAt > CACHE_TTL_MS) return false
  return true
}

export function clearCache() {
  _cache = null
}

export function hasValidAuthOptions(identifier) {
  return isCacheValid(identifier)
}

export async function warmCache(identifier, { force = false } = {}) {
  if (!identifier) {
    clearCache()
    return null
  }

  if (!force && isCacheValid(identifier)) {
    return _cache
  }

  if (_warmPromise) return _warmPromise

  _warmPromise = (async () => {
    try {
      const data = await post('/auth/webauthn/authenticate/options', { identifier })
      const normalized = normalizeOptions(data)

      _cache = {
        identifier,
        fetchedAt: Date.now(),
        ...normalized,
      }

      return _cache
    } catch (err) {
      _cache = null
      throw err
    } finally {
      _warmPromise = null
    }
  })()

  return _warmPromise
}

export async function loginBiometric(identifier) {
  if (!isCacheValid(identifier)) {
    throw new Error('Biometría no preparada todavía. Espera un momento y vuelve a intentar.')
  }

  const cached = _cache
  _cache = null

  const { userId, optionsJSON } = cached

  let assertion
  try {
    assertion = await startAuthentication({ optionsJSON })
  } catch (bioErr) {
    if (bioErr?.name === 'NotAllowedError') {
      throw new Error('Autenticación cancelada. Acepta el prompt de Windows Hello.')
    }
    if (bioErr?.name === 'InvalidStateError') {
      throw new Error('Credencial no encontrada. Re-registra tu biometría.')
    }
    if (bioErr?.name === 'SecurityError' || bioErr?.message?.includes('timed out')) {
      throw new Error('Tiempo agotado o no permitido. Verifica Windows Hello en tu PC.')
    }
    throw new Error(`Error biométrico: ${bioErr?.message ?? 'Error desconocido'}`)
  }

  return post('/auth/webauthn/authenticate/verify', {
    userId,
    ...assertion,
  })
}

export async function registerBiometric(friendlyName = 'Mi dispositivo') {
  const optionsJSON = await post('/auth/webauthn/register/options', {})
  const attResp = await startRegistration({ optionsJSON })
  await post('/auth/webauthn/register/verify', { ...attResp, friendlyName })
}