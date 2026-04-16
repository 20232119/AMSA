import { useState, useEffect, useRef } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import AppShell from '../components/AppShell.jsx'
import { Card, Button, PageSpinner, EmptyState } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'

const STATUS_CFG = {
  present: { label: 'Presente', color: 'var(--green-700)', bg: 'var(--success-bg)', points: 2 },
  excuse: { label: 'Excusa', color: 'var(--blue-700)', bg: '#D6EAF8', points: 2 },
  late: { label: 'Tardanza', color: 'var(--gold-500)', bg: 'var(--warning-bg)', points: 1 },
  absent: { label: 'Ausente', color: 'var(--error)', bg: 'var(--error-bg)', points: 0 },
  pending: { label: 'Pendiente', color: 'var(--stone-400)', bg: 'var(--stone-100)', points: 0 },
}

function parseJwt(token) {
  try {
    const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(
      decodeURIComponent(
        atob(b)
          .split('')
          .map((c) => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
          .join('')
      )
    )
  } catch {
    return null
  }
}

function formatHour(dateValue) {
  if (!dateValue) return 'Horario no definido'

  const d = new Date(dateValue)
  return d.toLocaleTimeString('es-DO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export default function AsistenciaEstudiante() {
  const navItems = navForRole('estudiante')
  const [open, setOpen] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)
  const [msg, setMsg] = useState(null)

  const pendingOptions = useRef({})

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    pendingOptions.current = {}

    try {
      const [openRes, histRes] = await Promise.all([
        api.get('/attendance/open').catch(() => []),
        api.get('/attendance/history').catch(() => []),
      ])

      setOpen(Array.isArray(openRes) ? openRes : [])
      setHistory(Array.isArray(histRes) ? histRes : [])
    } finally {
      setLoading(false)
    }
  }

  async function prefetchOptions(sessionId) {
    if (!sessionId) return
    if (pendingOptions.current[sessionId]?.optionsJSON?.challenge) return

    try {
      const token = localStorage.getItem('accessToken')
      const payload = parseJwt(token)
      const identifier = payload?.institutionalId ?? payload?.email

      if (!identifier || !token) return

      const res = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ identifier }),
      })

      if (!res.ok) return

      const data = await res.json()
      const { userId, ...optionsJSON } = data

      if (Array.isArray(optionsJSON.allowCredentials)) {
        optionsJSON.allowCredentials = optionsJSON.allowCredentials.map((c) => ({
          ...c,
          type: 'public-key',
        }))
      }

      pendingOptions.current[sessionId] = {
        userId,
        optionsJSON,
        fetchedAt: Date.now(),
      }
    } catch {
      // ignore
    }
  }

  async function markAttendance(sessionId) {
    setMarking(sessionId)
    setMsg(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) throw new Error('No se encontró la sesión del usuario.')

      const cached = pendingOptions.current[sessionId]

      if (!cached?.optionsJSON?.challenge) {
        prefetchOptions(sessionId).catch(() => {})
        throw new Error('Preparando biometría. Vuelve a pulsar el botón.')
      }

      delete pendingOptions.current[sessionId]

      const { userId, optionsJSON } = cached

      let assertion
      try {
        assertion = await startAuthentication({ optionsJSON })
      } catch (bioErr) {
        console.error('WebAuthn error:', bioErr?.name, bioErr?.message)

        if (bioErr?.name === 'NotAllowedError') {
          throw new Error('Biometría cancelada. Acepta el prompt de Windows Hello / PIN.')
        }
        if (bioErr?.name === 'InvalidStateError') {
          throw new Error('Credencial no encontrada. Ve a Configurar biometría y re-registra tu huella.')
        }
        if (bioErr?.name === 'SecurityError' || bioErr?.message?.includes('timed out')) {
          throw new Error('Tiempo agotado o no permitido. Asegúrate de que Windows Hello esté habilitado en tu PC.')
        }

        throw new Error(`Error biométrico: ${bioErr?.message ?? 'Error desconocido'}`)
      }

      const verRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...assertion }),
      })

      if (!verRes.ok) {
        const err = await verRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'La verificación biométrica falló.')
      }

      await api.post('/attendance/mark', { sessionId })
      setMsg({ type: 'success', text: '¡Asistencia registrada con biometría! ✓' })
      await loadAll()
    } catch (e) {
      setMsg({ type: 'error', text: e?.message ?? 'No se pudo registrar la asistencia.' })
    } finally {
      setMarking(null)
    }
  }

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 6 }}>
        Mi asistencia
      </h2>

      <p style={{ color: 'var(--stone-400)', fontSize: 14, marginBottom: 28 }}>
        Registra tu presencia y consulta tu historial
      </p>

      {msg && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            fontSize: 13.5,
            marginBottom: 20,
            background: msg.type === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
            color: msg.type === 'success' ? 'var(--success)' : 'var(--error)',
            border: `1px solid ${msg.type === 'success' ? '#A9DFBF' : '#F1948A'}`,
          }}
        >
          {msg.text}
        </div>
      )}

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--stone-700)',
              marginBottom: 12,
            }}
          >
            Sesiones abiertas ahora
          </h3>

          {open.length === 0 ? (
            <Card style={{ marginBottom: 28 }}>
              <EmptyState
                icon="✅"
                title="Sin sesiones activas"
                desc="No hay clases disponibles para registrar en este momento."
              />
            </Card>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                marginBottom: 28,
              }}
            >
              {open.map((sess) => (
                <Card
                  key={sess.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {sess.section?.course?.name ?? 'Clase'}
                    </div>

                    <div style={{ fontSize: 13, color: 'var(--stone-400)', marginTop: 3 }}>
                      {sess.section?.professor?.firstName} {sess.section?.professor?.lastName}
                      {sess.topic && <> · {sess.topic}</>}
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--stone-400)', marginTop: 4 }}>
                      {formatHour(sess.startAt)} — {formatHour(sess.endAt)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--error)',
                        animation: 'pulse 1.5s infinite',
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--error)' }}>
                      Disponible ahora
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    onMouseEnter={() => prefetchOptions(sess.id)}
                    onFocus={() => prefetchOptions(sess.id)}
                    onClick={() => markAttendance(sess.id)}
                    disabled={!!marking}
                  >
                    {marking === sess.id ? '🔒 Verificando…' : '👆 Registrar asistencia'}
                  </Button>
                </Card>
              ))}
            </div>
          )}

          <h3
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--stone-700)',
              marginBottom: 12,
            }}
          >
            Historial por materia
          </h3>

          {history.length === 0 ? (
            <EmptyState icon="📋" title="Sin historial" desc="Aún no tienes registros de asistencia." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((h) => {
                const sessions = h.sessions ?? []
                const totalSessions = h.totalSessions ?? sessions.length
                const totalPoints = h.totalPoints ?? 0
                const maxPoints = totalSessions * 2
                const attended = sessions.filter((s) =>
                  ['present', 'excuse', 'late'].includes(s.status)
                ).length
                const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0

                return (
                  <Card key={h.sectionId}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 14,
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{h.courseName}</div>
                        <div style={{ fontSize: 12.5, color: 'var(--stone-400)', marginTop: 2 }}>
                          {h.courseCode}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: 22,
                            fontWeight: 700,
                            color: percentage >= 75 ? 'var(--green-700)' : 'var(--error)',
                          }}
                        >
                          {percentage}%
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--stone-400)' }}>
                          {attended}/{totalSessions} sesiones
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--green-700)',
                            marginTop: 2,
                          }}
                        >
                          {totalPoints}/{maxPoints} pts de asistencia
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        height: 6,
                        background: 'var(--stone-100)',
                        borderRadius: 99,
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          height: 6,
                          width: `${percentage}%`,
                          borderRadius: 99,
                          background: percentage >= 75 ? 'var(--green-700)' : 'var(--error)',
                          transition: 'width .4s',
                        }}
                      />
                    </div>

                    {percentage < 75 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--error)',
                          fontWeight: 500,
                          marginBottom: 10,
                        }}
                      >
                        ⚠ Por debajo del mínimo requerido (75%)
                      </div>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {sessions.map((sess) => {
                        const cfg = STATUS_CFG[sess.status] ?? STATUS_CFG.pending
                        return (
                          <div
                            key={sess.sessionId}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              padding: '5px 10px',
                              borderRadius: 'var(--radius-md)',
                              background: cfg.bg,
                              border: `1px solid ${cfg.color}30`,
                              minWidth: 64,
                            }}
                          >
                            <span style={{ fontSize: 10, color: 'var(--stone-400)', marginBottom: 2 }}>
                              Ses. {sess.sessionNo}
                            </span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: cfg.color }}>
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--stone-400)' }}>
                              {new Date(sess.date).toLocaleDateString('es-DO', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>
                              +{sess.points ?? cfg.points}pts
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}