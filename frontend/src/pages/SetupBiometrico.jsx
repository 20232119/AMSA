// src/pages/SetupBiometrico.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import AppShell from '../components/AppShell.jsx'
import { Card, Button, Badge, PageSpinner } from '../components/ui.jsx'
import { api } from '../lib/api.js'
import { navForRole } from '../lib/navItems.js'

export default function SetupBiometrico() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const [creds,   setCreds]   = useState([])
  const [loading, setLoading] = useState(true)
  const [regState, setReg]   = useState('idle') // idle | loading | success | error
  const [regMsg,  setRegMsg]  = useState('')

  useEffect(() => { loadCreds() }, [])

  async function loadCreds() {
    try {
      const data = await api.get('/auth/webauthn/credentials')
      setCreds(data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  async function handleRegister() {
    setReg('loading'); setRegMsg('')
    try {
      const { startRegistration } = await import('@simplewebauthn/browser')
      const optionsJSON = await api.post('/auth/webauthn/register/options', {})
      const attResp     = await startRegistration({ optionsJSON })
      await api.post('/auth/webauthn/register/verify', { ...attResp, friendlyName: `Dispositivo ${creds.length + 1}` })
      setReg('success'); setRegMsg('¡Credencial registrada exitosamente!')
      loadCreds()
    } catch (err) {
      setReg('error'); setRegMsg(err.message ?? 'Error registrando credencial')
    }
  }

  async function handleDelete(id) {
    await api.delete(`/auth/webauthn/credentials/${id}`)
    setCreds(prev => prev.filter(c => c.id !== id))
  }

  const role = user?.role?.name ?? user?.role
  const navItems = navForRole(role)

  return (
    <AppShell navItems={navItems}>
      <div style={{ maxWidth:560 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', color:'var(--stone-900)', marginBottom:6 }}>Biometría</h2>
        <p style={{ color:'var(--stone-400)', fontSize:14, marginBottom:32 }}>
          Registra tu huella dactilar o Face ID para iniciar sesión sin contraseña.
        </p>

        {regMsg && (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius-md)', fontSize:13.5, marginBottom:20,
            background: regState === 'success' ? 'var(--success-bg)' : 'var(--error-bg)',
            color:      regState === 'success' ? 'var(--success)' : 'var(--error)',
            border: `1px solid ${regState === 'success' ? '#A9DFBF' : '#F1948A'}`,
          }}>
            {regMsg}
          </div>
        )}

        <Card style={{ marginBottom:20 }}>
          <div style={{ fontWeight:600, marginBottom:4 }}>Agregar nuevo dispositivo</div>
          <div style={{ fontSize:13.5, color:'var(--stone-400)', marginBottom:16 }}>
            Se te pedirá autenticarte con tu dispositivo (huella, Face ID, PIN).
          </div>
          <Button variant="primary" onClick={handleRegister} disabled={regState === 'loading'}>
            {regState === 'loading' ? 'Esperando dispositivo…' : '+ Registrar biometría'}
          </Button>
        </Card>

        <Card>
          <div style={{ fontWeight:600, marginBottom:16 }}>Credenciales registradas</div>
          {loading ? <PageSpinner /> : creds.length === 0 ? (
            <div style={{ textAlign:'center', padding:'24px 0', color:'var(--stone-400)', fontSize:14 }}>
              Ninguna credencial registrada aún.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {creds.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', background:'var(--stone-50)', borderRadius:'var(--radius-md)', border:'1px solid var(--stone-200)' }}>
                  <FingerprintIcon />
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:14, fontWeight:600 }}>{c.friendlyName ?? 'Dispositivo'}</div>
                    <div style={{ fontSize:12, color:'var(--stone-400)' }}>
                      {c.deviceType ?? 'Desconocido'} · Último uso: {c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleDateString('es-DO') : 'Nunca'}
                    </div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)}>Eliminar</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

function FingerprintIcon() {
  return <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="var(--green-700)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4"/><path d="M5 19.5C5.5 18 6 15 6 12c0-1.9.7-3.7 2-5"/><path d="M17.8 21.8c.2-.7.2-1.5.2-2.3a8 8 0 0 0-2-5.3"/><path d="M10.9 7A6 6 0 0 1 18 12c0 .8 0 1.6-.1 2.4"/><path d="M12 12c0 3-1 5.5-3 7.5"/><path d="M12 12c0 1.7-.3 3.4-1 5"/></svg>
}
