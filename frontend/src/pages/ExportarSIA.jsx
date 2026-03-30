// src/pages/ExportarSIA.jsx
import { useState, useEffect } from 'react'
import AppShell   from '../components/AppShell.jsx'
import { Card, Button, Badge, PageSpinner, EmptyState } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api, downloadFile } from '../lib/api.js'

const STATUS_CFG = {
  validado:  { label:'Listo para exportar', color:'green',  dot:'var(--green-700)' },
  parcial:   { label:'Notas incompletas',   color:'amber',  dot:'var(--gold-500)'  },
  pendiente: { label:'Sin notas',           color:'red',    dot:'var(--error)'     },
}
const EXPORT_TYPES = { grades:'Calificaciones', attendance:'Asistencia', all:'Cal. + Asist.' }

function Checkbox({ checked }) {
  return checked
    ? <svg width={20} height={20} viewBox="0 0 20 20" fill="none"><rect width={20} height={20} rx={5} fill="#1A5276"/><polyline points="5,10 8.5,13.5 15,7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
    : <svg width={20} height={20} viewBox="0 0 20 20" fill="none"><rect width={20} height={20} rx={5} fill="white" stroke="#D0D5D2" strokeWidth="1.5"/></svg>
}

export default function ExportarSIA() {
  const navItems = navForRole('registro')
  const [sections,  setSections]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(new Set())
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [expType,   setExpType]   = useState('grades')
  const [status,    setStatus]    = useState('idle')
  const [log,       setLog]       = useState([])

  useEffect(() => {
    api.get('/grades/registro/pendientes').then(data => {
      const norm = data.map(sec => {
        const total  = sec.enrollments?.filter(e => e.status === 'activo').length ?? 0
        const sent   = sec.grades?.filter(g => ['enviado','validado','publicado'].includes(g.status)).length ?? 0
        const secStatus = total === 0 ? 'pendiente' : sent === total ? 'validado' : sent > 0 ? 'parcial' : 'pendiente'
        return {
          id:           sec.id,
          code:         `${sec.course.code}-0${sec.sectionNo}`,
          name:         sec.course.name,
          professor:    `${sec.professor?.firstName ?? ''} ${sec.professor?.lastName ?? ''}`.trim(),
          period:       sec.period?.name ?? '—',
          enrolled:     total,
          sent,
          status:       secStatus,
        }
      })
      setSections(norm)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const filtered = sections.filter(s => {
    const mf = filter === 'all' || s.status === filter
    const ms = !search || [s.name, s.code, s.professor].some(v => v.toLowerCase().includes(search.toLowerCase()))
    return mf && ms
  })
  const exportable = filtered.filter(s => s.status !== 'pendiente')
  const allChecked = exportable.length > 0 && exportable.every(s => selected.has(s.id))

  function toggle(id) {
    const sec = sections.find(s => s.id === id)
    if (!sec || sec.status === 'pendiente' || status === 'loading') return
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    if (status === 'loading') return
    setSelected(prev => {
      const n = new Set(prev)
      allChecked ? exportable.forEach(s => n.delete(s.id)) : exportable.forEach(s => n.add(s.id))
      return n
    })
  }

  async function handleExport() {
    setStatus('loading'); setLog([])
    const toExport = sections.filter(s => selected.has(s.id))
    const newLog   = []
    for (const sec of toExport) {
      newLog.push({ msg:`Exportando ${sec.name}…`, st:'loading' })
      setLog([...newLog])
      try {
        await downloadFile(`/export/section/${sec.id}?type=${expType}`, `UAFAM_${sec.code}_${expType}_${new Date().toISOString().slice(0,10)}.xlsx`)
        newLog[newLog.length-1] = { msg:`${sec.name} — ${sec.enrolled} estudiantes exportados`, st:'done' }
      } catch (e) {
        newLog[newLog.length-1] = { msg:`Error en ${sec.name}: ${e.message}`, st:'error' }
      }
      setLog([...newLog])
    }
    setStatus(newLog.some(l => l.st === 'error') ? 'error' : 'success')
    setSelected(new Set())
  }

  return (
    <AppShell navItems={navItems}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .8s linear infinite}`}</style>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28, flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.8rem', color:'var(--stone-900)', margin:0 }}>Exportar a SIA</h2>
          <p style={{ color:'var(--stone-400)', fontSize:14, marginTop:6 }}>Selecciona las secciones y descarga el reporte Excel</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Badge color="green">{sections.filter(s=>s.status==='validado').length} listas</Badge>
          <Badge color="amber">{sections.filter(s=>s.status==='parcial').length} incompletas</Badge>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
        {[['all','Todas'],['validado','✓ Listas'],['parcial','⚠ Incompletas']].map(([f,l]) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'6px 16px', borderRadius:99, fontSize:13, fontWeight:500, cursor:'pointer', border: filter===f ? '1.5px solid var(--green-800)' : '1.5px solid var(--stone-200)', background: filter===f ? 'var(--green-800)' : '#fff', color: filter===f ? '#fff' : 'var(--stone-700)', transition:'all .15s' }}>{l}</button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar materia, código o profesor…" style={{ marginLeft:'auto', padding:'7px 14px', borderRadius:'var(--radius-md)', border:'1.5px solid var(--stone-200)', fontSize:13, outline:'none', background:'#fff', color:'var(--stone-900)', width:260 }} />
      </div>

      {/* Select all */}
      <div onClick={toggleAll} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', background:'var(--stone-100)', borderRadius:10, marginBottom:8, border:'1px solid var(--stone-200)', cursor:'pointer', userSelect:'none' }}>
        <Checkbox checked={allChecked} />
        <span style={{ fontSize:13, fontWeight:600, color:'var(--stone-700)' }}>{allChecked ? 'Deseleccionar todo' : 'Seleccionar todo'}</span>
        {selected.size > 0 && <span style={{ marginLeft:'auto', fontSize:13, fontWeight:600, color:'var(--green-800)' }}>{selected.size} seleccionada{selected.size>1?'s':''}</span>}
      </div>

      {/* List */}
      {loading ? <PageSpinner /> : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="Sin resultados" desc="No se encontraron secciones." />
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:24 }}>
          {filtered.map(sec => {
            const cfg     = STATUS_CFG[sec.status]
            const checked = selected.has(sec.id)
            const disabled = sec.status === 'pendiente'
            const pct     = sec.enrolled > 0 ? Math.round(sec.sent / sec.enrolled * 100) : 0
            return (
              <div key={sec.id} onClick={() => toggle(sec.id)} style={{ display:'flex', alignItems:'center', gap:14, padding:'13px 16px', background: checked ? '#EBF3FB' : '#fff', border: checked ? '1.5px solid var(--green-800)' : '1.5px solid var(--stone-200)', borderRadius:12, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .5 : 1, transition:'all .15s' }}>
                <Checkbox checked={checked} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <span style={{ fontSize:14, fontWeight:700, color:'var(--stone-900)' }}>{sec.name}</span>
                    <span style={{ fontSize:10.5, fontFamily:'monospace', background:'var(--stone-100)', color:'var(--stone-700)', padding:'2px 7px', borderRadius:5, fontWeight:700 }}>{sec.code}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--stone-400)', marginTop:3 }}>{sec.professor} · {sec.period} · {sec.enrolled} estudiantes</div>
                </div>
                {sec.status === 'parcial' && (
                  <div style={{ width:90, flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'var(--stone-400)', textAlign:'right', marginBottom:4 }}>{sec.sent}/{sec.enrolled}</div>
                    <div style={{ height:5, background:'var(--stone-100)', borderRadius:99 }}>
                      <div style={{ height:5, width:`${pct}%`, background:'var(--gold-500)', borderRadius:99 }} />
                    </div>
                  </div>
                )}
                <Badge color={cfg.color}>{cfg.label}</Badge>
              </div>
            )
          })}
        </div>
      )}

      {/* Sticky export bar */}
      {selected.size > 0 && status !== 'success' && (
        <div style={{ position:'sticky', bottom:24, background:'#fff', border:'1.5px solid var(--stone-200)', borderRadius:14, padding:'14px 20px', boxShadow:'0 8px 32px rgba(26,82,118,.12)', display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', zIndex:20 }}>
          <div style={{ display:'flex', gap:5 }}>
            {Object.entries(EXPORT_TYPES).map(([k,v]) => (
              <button key={k} onClick={() => setExpType(k)} style={{ padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer', border: expType===k ? '1.5px solid var(--green-800)' : '1.5px solid var(--stone-200)', background: expType===k ? 'var(--green-50)' : 'var(--stone-50)', color: expType===k ? 'var(--green-800)' : 'var(--stone-500)' }}>{v}</button>
            ))}
          </div>
          <div style={{ flex:1, fontSize:13.5, color:'var(--stone-700)', fontWeight:500 }}>
            Exportar <strong>{selected.size}</strong> sección{selected.size>1?'es':''} · <em>{EXPORT_TYPES[expType]}</em>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>Cancelar</Button>
            <Button variant="primary" onClick={handleExport} disabled={status==='loading'}>
              {status==='loading' ? <><div className="spin" style={{ width:14, height:14, borderRadius:'50%', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff' }} /> Exportando…</> : '⬆ Exportar a SIA'}
            </Button>
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <Card style={{ marginTop:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--stone-500)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:10 }}>Progreso</div>
          {log.map((entry, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', fontSize:13.5 }}>
              {entry.st === 'loading' && <div className="spin" style={{ width:16, height:16, borderRadius:'50%', border:'2px solid var(--stone-200)', borderTopColor:'var(--green-700)', flexShrink:0 }} />}
              {entry.st === 'done'    && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--green-700)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><polyline points="20 6 9 17 4 12"/></svg>}
              {entry.st === 'error'   && <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
              <span style={{ color: entry.st==='done' ? 'var(--green-800)' : entry.st==='error' ? 'var(--error)' : 'var(--stone-700)' }}>{entry.msg}</span>
            </div>
          ))}
        </Card>
      )}

      {/* Success */}
      {status === 'success' && (
        <div style={{ marginTop:16, padding:'18px 22px', background:'var(--success-bg)', borderRadius:12, border:'1.5px solid #A9DFBF', display:'flex', alignItems:'center', gap:16 }}>
          <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--green-700)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'var(--green-800)' }}>¡Exportación completada!</div>
            <div style={{ fontSize:13, color:'var(--green-700)', marginTop:3 }}>{log.length} sección{log.length>1?'es':''} exportada{log.length>1?'s':''} exitosamente.</div>
          </div>
          <button onClick={() => { setStatus('idle'); setLog([]) }} style={{ marginLeft:'auto', padding:'7px 16px', borderRadius:8, border:'1.5px solid var(--green-700)', background:'#fff', fontSize:13, fontWeight:600, color:'var(--green-700)', cursor:'pointer' }}>
            Nueva exportación
          </button>
        </div>
      )}
    </AppShell>
  )
}
