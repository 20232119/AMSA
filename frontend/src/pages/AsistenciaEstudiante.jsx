import { useState, useEffect } from 'react'
import { startAuthentication } from '@simplewebauthn/browser'
import AppShell from '../components/AppShell.jsx'
import { Card, Button, PageSpinner, EmptyState } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'

const STATUS_CFG = {
  present: { label: 'Presente', color: 'var(--green-700)', bg: 'var(--success-bg)', points: 2 },
  excuse:  { label: 'Excusa',   color: 'var(--blue-700)',  bg: '#D6EAF8',           points: 2 },
  late:    { label: 'Tardanza', color: 'var(--gold-500)',  bg: 'var(--warning-bg)', points: 1 },
  absent:  { label: 'Ausente',  color: 'var(--error)',     bg: 'var(--error-bg)',   points: 0 },
}

export default function AsistenciaEstudiante() {
  const navItems = navForRole('estudiante')
  const [open, setOpen] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(null)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
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

  async function markAttendance(sessionId) {
    setMarking(sessionId)
    setMsg(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No se encontró la sesión del usuario.')
      }

      // 1. Obtener opciones biométricas en modo discoverable
      const optRes = await fetch('/api/auth/webauthn/authenticate/options', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ identifier: null }),
      })

      if (!optRes.ok) {
        const err = await optRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'Error obteniendo opciones biométricas.')
      }

      const optData = await optRes.json()
      const { userId, ...optionsJSON } = optData

      // 2. Mostrar prompt biométrico
      let assertion
      try {
        assertion = await startAuthentication({
          optionsJSON,
          useBrowserAutofill: false,
        })
      } catch (bioErr) {
        if (bioErr?.name === 'NotAllowedError') {
          throw new Error('Biometría cancelada. Acepta el prompt de Windows Hello, huella, Face ID o PIN.')
        }
        if (bioErr?.name === 'NotSupportedError') {
          throw new Error('Tu dispositivo no soporta autenticación biométrica.')
        }
        throw new Error(bioErr?.message ?? 'Error en la autenticación biométrica.')
      }

      // 3. Verificar en backend
      const verRes = await fetch('/api/auth/webauthn/authenticate/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          _attendanceOnly: true,
          ...assertion,
        }),
      })

      if (!verRes.ok) {
        const err = await verRes.json().catch(() => ({}))
        throw new Error(err.error ?? 'La verificación biométrica falló.')
      }

      const verData = await verRes.json().catch(() => ({}))
      if (verData?.verified === false) {
        throw new Error('La biometría no pudo ser verificada correctamente.')
      }

      // 4. Registrar asistencia
      await api.post('/attendance/mark', { sessionId })

      setMsg({
        type: 'success',
        text: '¡Asistencia registrada con biometría! ✓',
      })

      await loadAll()
    } catch (e) {
      setMsg({
        type: 'error',
        text: e?.message ?? 'No se pudo registrar la asistencia.',
      })
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
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--stone-700)', marginBottom: 12 }}>
            Sesiones abiertas ahora
          </h3>

          {open.length === 0 ? (
            <Card style={{ marginBottom: 28 }}>
              <EmptyState
                icon="✅"
                title="Sin sesiones activas"
                desc="No hay clases en curso en este momento."
              />
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {open.map((sess) => (
                <Card
                  key={sess.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                      {sess.section?.course?.name ?? 'Clase'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--stone-400)', marginTop: 3 }}>
                      {sess.section?.professor?.firstName} {sess.section?.professor?.lastName}
                      {sess.topic && <> · {sess.topic}</>}
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
                      En curso
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => markAttendance(sess.id)}
                    disabled={!!marking}
                  >
                    {marking === sess.id ? '🔒 Verificando…' : '👆 Registrar con huella / Face ID'}
                  </Button>
                </Card>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--stone-700)', marginBottom: 12 }}>
            Historial por materia
          </h3>

          {history.length === 0 ? (
            <EmptyState icon="📋" title="Sin historial" desc="Aún no tienes registros de asistencia." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {history.map((h) => {
                const sessions = h.sessions ?? []
                const totalSessions = h.totalSessions ?? sessions.length
                const attended = sessions.filter((s) =>
                  ['present', 'excuse', 'late'].includes(s.status)
                ).length
                const percentage =
                  totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : 0
                const totalPoints = h.totalPoints ?? 0

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
                          {totalPoints} pts de asistencia
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
                        const cfg = STATUS_CFG[sess.status] ?? STATUS_CFG.absent
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
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--stone-400)',
                                marginBottom: 2,
                              }}
                            >
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