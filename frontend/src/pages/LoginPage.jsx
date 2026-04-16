// src/pages/LoginPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { loginBiometric, warmCache, clearCache, hasValidAuthOptions } from '../lib/webauthn.js'
import { Button } from '../components/ui.jsx'

export default function LoginPage() {
  const { login, loginWithTokens } = useAuth()
  const navigate = useNavigate()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [bioLoading, setBioLoading] = useState(false)
  const [cacheReady, setCacheReady] = useState(false)

  const warmRef = useRef(null)
  const debounce = useRef(null)

  function redirect(user) {
    const role = user.role?.name ?? user.role
    if (role === 'estudiante') navigate('/estudiante')
    else if (role === 'profesor') navigate('/profesor')
    else navigate('/registro')
  }

  async function doWarm(id, { force = false } = {}) {
    const cleanId = (id ?? '').trim()

    clearTimeout(warmRef.current)

    if (!cleanId || cleanId.length < 6) {
      setCacheReady(false)
      clearCache()
      return
    }

    if (!force && hasValidAuthOptions(cleanId)) {
      setCacheReady(true)
      warmRef.current = setTimeout(() => {
        doWarm(cleanId, { force: true }).catch(() => {})
      }, 45_000)
      return
    }

    setCacheReady(false)

    try {
      await warmCache(cleanId, { force })
      setCacheReady(true)

      // refresca antes de que venza el challenge
      warmRef.current = setTimeout(() => {
        doWarm(cleanId, { force: true }).catch(() => {})
      }, 45_000)
    } catch {
      setCacheReady(false)
    }
  }

  useEffect(() => {
    // por si el navegador autocompleta
    doWarm(identifier).catch(() => {})
    return () => {
      clearTimeout(warmRef.current)
      clearTimeout(debounce.current)
    }
  }, [])

  function handleIdentifierChange(val) {
    setIdentifier(val)
    setError('')

    clearTimeout(debounce.current)
    clearTimeout(warmRef.current)
    clearCache()
    setCacheReady(false)

    debounce.current = setTimeout(() => {
      doWarm(val).catch(() => {})
    }, 500)
  }

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(identifier, password)
      redirect(user)
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  async function handleBiometric() {
    const id = identifier.trim()

    if (!id) {
      setError('Ingresa tu matrícula primero')
      return
    }

    setError('')
    setBioLoading(true)

    try {
      const data = await loginBiometric(id)
      loginWithTokens(data)
      redirect(data.user)
    } catch (err) {
      const msg = err?.message ?? 'No se pudo autenticar con biometría.'

      if (msg.includes('Biometría no preparada')) {
        doWarm(id, { force: true }).catch(() => {})
        setError('Preparando biometría. Pulsa nuevamente en un momento.')
      } else {
        setError(msg)
        doWarm(id, { force: true }).catch(() => {})
      }
    } finally {
      setBioLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      {/* Left panel */}
      <div
        style={{
          background: '#1C2B25',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 64px',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--green-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a10 10 0 1 0 10 10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  color: '#fff',
                  fontWeight: 700,
                }}
              >
                UAFAM
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                Sistema Académico 2026
              </div>
            </div>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.8rem',
              color: '#fff',
              lineHeight: 1.2,
              marginBottom: 16,
            }}
          >
            Bienvenido de vuelta
          </h1>

          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 15, lineHeight: 1.7 }}>
            Sistema de asistencia biométrica y gestión académica de la Universidad Agroforestal
            Fernando Arturo de Meriño.
          </p>

          <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              ['Biometría', 'Face ID y huella dactilar'],
              ['Tiempo real', 'Asistencia en tiempo real'],
              ['Integración', 'Exportación directa a SIA'],
            ].map(([t, d]) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--green-700)',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <span style={{ fontSize: 13.5, color: '#fff', fontWeight: 600 }}>{t}</span>
                  <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,.45)' }}> — {d}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          background: 'var(--stone-50)',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.8rem',
              marginBottom: 6,
              color: 'var(--stone-900)',
            }}
          >
            Iniciar sesión
          </h2>

          <p style={{ color: 'var(--stone-400)', fontSize: 14, marginBottom: 36 }}>
            Ingresa tu matrícula y contraseña
          </p>

          {error && (
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--error-bg)',
                borderRadius: 'var(--radius-md)',
                fontSize: 13.5,
                color: 'var(--error)',
                marginBottom: 20,
                border: '1px solid #F1948A',
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Matrícula / Correo</label>
              <input
                value={identifier}
                onChange={(e) => handleIdentifierChange(e.target.value)}
                onBlur={() => doWarm(identifier).catch(() => {})}
                placeholder="2025-0001"
                style={inputStyle}
                required
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              style={{ width: '100%', marginTop: 4 }}
            >
              {loading ? 'Ingresando…' : 'Iniciar sesión'}
            </Button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--stone-200)' }} />
            <span style={{ fontSize: 12, color: 'var(--stone-400)' }}>o</span>
            <div style={{ flex: 1, height: 1, background: 'var(--stone-200)' }} />
          </div>

          <button
            onMouseEnter={() => doWarm(identifier).catch(() => {})}
            onFocus={() => doWarm(identifier).catch(() => {})}
            onClick={handleBiometric}
            disabled={bioLoading}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: 'var(--radius-md)',
              border: `1.5px solid ${cacheReady ? 'var(--green-700)' : 'var(--stone-200)'}`,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              fontSize: 14,
              fontWeight: 600,
              color: cacheReady ? 'var(--green-700)' : 'var(--stone-400)',
              cursor: bioLoading ? 'not-allowed' : 'pointer',
              opacity: bioLoading ? 0.6 : 1,
              transition: 'all .3s',
            }}
          >
            <FingerprintSvg />
            {bioLoading
              ? 'Autenticando…'
              : cacheReady
                ? 'Usar huella / Face ID ✓'
                : 'Usar huella / Face ID'}
          </button>

          {!cacheReady && identifier.trim().length >= 6 && (
            <p
              style={{
                textAlign: 'center',
                fontSize: 11.5,
                color: 'var(--stone-400)',
                marginTop: 8,
              }}
            >
              Preparando opciones biométricas…
            </p>
          )}

          <p
            style={{
              marginTop: 24,
              fontSize: 12,
              color: 'var(--stone-400)',
              textAlign: 'center',
            }}
          >
            Usuarios de prueba: <code style={{ fontSize: 11 }}>2025-0001</code> ·{' '}
            <code style={{ fontSize: 11 }}>EMP-0042</code> ·{' '}
            <code style={{ fontSize: 11 }}>REG-0005</code>
            <br />
            Contraseña: <code style={{ fontSize: 11 }}>Test1234!</code>
          </p>
        </div>
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--stone-500)',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  display: 'block',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--stone-200)',
  fontSize: 14,
  outline: 'none',
  background: '#fff',
  color: 'var(--stone-900)',
  boxSizing: 'border-box',
}

function FingerprintSvg() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
      <path d="M5 19.5C5.5 18 6 15 6 12c0-1.9.7-3.7 2-5" />
      <path d="M17.8 21.8c.2-.7.2-1.5.2-2.3a8 8 0 0 0-2-5.3" />
      <path d="M10.9 7A6 6 0 0 1 18 12c0 .8 0 1.6-.1 2.4" />
      <path d="M12 12c0 3-1 5.5-3 7.5" />
      <path d="M12 12c0 1.7-.3 3.4-1 5" />
    </svg>
  )
}