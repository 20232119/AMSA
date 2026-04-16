import { useEffect, useMemo, useState } from 'react'
import Swal from 'sweetalert2'
import AppShell from '../components/AppShell.jsx'
import { Card, Button, PageSpinner, EmptyState, Badge, SectionTitle } from '../components/ui.jsx'
import { navForRole } from '../lib/navItems.js'
import { api } from '../lib/api.js'

const initialSectionForm = {
  courseId: '',
  professorId: '',
  periodId: '',
  sectionNo: 1,
  classDay: '',
  startTime: '',
  endTime: '',
}

export default function GestionAcademica() {
  const navItems = navForRole('registro')

  const [tab, setTab] = useState('secciones')

  const [sections, setSections] = useState([])
  const [professors, setProfessors] = useState([])
  const [students, setStudents] = useState([])
  const [courses, setCourses] = useState([])
  const [periods, setPeriods] = useState([])

  const [activeId, setActiveId] = useState('')
  const [board, setBoard] = useState(null)

  const [loading, setLoading] = useState(true)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [savingDate, setSavingDate] = useState(false)
  const [savingSection, setSavingSection] = useState(false)
  const [savingEnrollments, setSavingEnrollments] = useState(false)

  const [startDate, setStartDate] = useState('')
  const [msg, setMsg] = useState(null)

  const [sectionForm, setSectionForm] = useState(initialSectionForm)
  const [selectedStudentIds, setSelectedStudentIds] = useState([])

  const [editingSessions, setEditingSessions] = useState(false)

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    if (activeId) {
      loadBoard(activeId)
    }
  }, [activeId])

  async function loadInitialData() {
    setLoading(true)
    setMsg(null)

    try {
      const [
        sectionsRes,
        professorsRes,
        studentsRes,
        coursesRes,
        periodsRes,
      ] = await Promise.allSettled([
        api.get('/sections'),
        api.get('/users/professors'),
        api.get('/users/students'),
        api.get('/courses'),
        api.get('/periods'),
      ])

      const sectionsData =
        sectionsRes.status === 'fulfilled' && Array.isArray(sectionsRes.value)
          ? sectionsRes.value
          : []

      const professorsData =
        professorsRes.status === 'fulfilled' && Array.isArray(professorsRes.value)
          ? professorsRes.value
          : []

      const studentsData =
        studentsRes.status === 'fulfilled' && Array.isArray(studentsRes.value)
          ? studentsRes.value
          : []

      const coursesData =
        coursesRes.status === 'fulfilled' && Array.isArray(coursesRes.value)
          ? coursesRes.value
          : []

      const periodsData =
        periodsRes.status === 'fulfilled' && Array.isArray(periodsRes.value)
          ? periodsRes.value
          : []

      setSections(sectionsData)
      setProfessors(professorsData)
      setStudents(studentsData)
      setCourses(coursesData)
      setPeriods(periodsData)

      if (sectionsData.length) {
        setActiveId((prev) => prev || sectionsData[0].id)
      }

      if (coursesData.length) {
        setSectionForm((prev) => ({
          ...prev,
          courseId: prev.courseId || String(coursesData[0].id),
        }))
      }

      if (professorsData.length) {
        setSectionForm((prev) => ({
          ...prev,
          professorId: prev.professorId || professorsData[0].id,
        }))
      }

      if (periodsData.length) {
        setSectionForm((prev) => ({
          ...prev,
          periodId: prev.periodId || String(periodsData[0].id),
        }))
      }
    } catch (e) {
      setMsg({
        type: 'error',
        text: e?.message || 'No se pudo cargar la gestión académica.',
      })
    } finally {
      setLoading(false)
    }
  }

  async function refreshSections(keepCurrent = true) {
    try {
      const data = await api.get('/sections')
      const safeData = Array.isArray(data) ? data : []

      setSections(safeData)

      if (!safeData.length) {
        setActiveId('')
        return
      }

      if (keepCurrent && activeId && safeData.some((s) => s.id === activeId)) {
        return
      }

      setActiveId(safeData[0].id)
    } catch (e) {
      setMsg({
        type: 'error',
        text: e?.message || 'No se pudieron refrescar las secciones.',
      })
    }
  }

  async function loadBoard(sectionId) {
    setLoadingBoard(true)
    setMsg(null)

    try {
      const data = await api.get(`/attendance/sections/${sectionId}/board`)
      setBoard(data)

      setEditingSessions(false)

      const found = sections.find((s) => s.id === sectionId)
      const initial = found?.startDate
        ? new Date(found.startDate).toISOString().slice(0, 10)
        : ''

      setStartDate(initial)
      setSelectedStudentIds((data?.students ?? []).map((s) => s.id))
    } catch (e) {
      setBoard(null)
      setSelectedStudentIds([])
      setMsg({
        type: 'error',
        text: e?.message || 'No se pudo cargar la sección.',
      })
    } finally {
      setLoadingBoard(false)
    }
  }

  function updateSectionForm(field, value) {
    setSectionForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleCreateSection(e) {
    e.preventDefault()

    if (savingSection) return

    const {
      courseId,
      professorId,
      periodId,
      sectionNo,
      classDay,
      startTime,
      endTime,
    } = sectionForm

    if (!courseId || !professorId || !periodId || !classDay || !startTime || !endTime) {
      setMsg({
        type: 'error',
        text: 'Completa todos los campos (incluyendo día y horas).',
      })
      return
    }

    if (startTime >= endTime) {
      setMsg({
        type: 'error',
        text: 'La hora de fin debe ser mayor que la de inicio.',
      })
      return
    }

    setSavingSection(true)
    setMsg(null)

    try {
      const payload = {
        courseId: Number(courseId),
        professorId,
        periodId: Number(periodId),
        sectionNo: Number(sectionNo),
        classDay,
        startTime,
        endTime,
      }

      const created = await api.post('/sections', payload)

      setMsg({ type: 'success', text: 'Sección creada correctamente.' })

      setSectionForm((prev) => ({
        ...prev,
        sectionNo: Number(prev.sectionNo) + 1,
        classDay: '',
        startTime: '',
        endTime: '',
      }))

      await refreshSections(false)

      if (created?.id) {
        setActiveId(created.id)
      }

      setTab('estudiantes')
    } catch (e) {
      setMsg({
        type: 'error',
        text: e?.error || e?.message || 'No se pudo crear la sección.',
      })
    } finally {
      setSavingSection(false)
    }
  }

  async function handleSaveEnrollments() {
    if (!activeId || savingEnrollments) return

    setSavingEnrollments(true)
    setMsg(null)

    try {
      await api.post(`/sections/${activeId}/enrollments`, {
        studentIds: selectedStudentIds,
      })

      await Swal.fire({
        icon: 'success',
        title: 'Estudiantes actualizados',
        text: 'La inscripción de estudiantes fue guardada.',
        confirmButtonColor: '#1A5276',
      })

      await loadBoard(activeId)
    } catch (e) {
      setMsg({
        type: 'error',
        text:
          e?.message ||
          'No se pudieron guardar las inscripciones. Verifica que exista POST /sections/:id/enrollments.',
      })
    } finally {
      setSavingEnrollments(false)
    }
  }

  async function handleSetDate() {
    if (!activeId || !startDate || savingDate) return

    setSavingDate(true)
    setMsg(null)

    try {
      if (alreadyConfigured) {
        const confirmResult = await Swal.fire({
          icon: 'warning',
          title: 'Esta materia ya tiene sesiones registradas',
          text: 'Si deseas cambiarlas, debes confirmar la edición y escribir un comentario explicando el motivo.',
          showCancelButton: true,
          confirmButtonText: 'Sí, editar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#1A5276',
          cancelButtonColor: '#7f8c8d',
          reverseButtons: true,
        })

        if (!confirmResult.isConfirmed) {
          return
        }

        const reasonResult = await Swal.fire({
          icon: 'question',
          title: 'Motivo de la edición',
          input: 'textarea',
          inputLabel: 'Comentario obligatorio',
          inputPlaceholder: 'Escribe por qué se están modificando las sesiones...',
          inputAttributes: {
            'aria-label': 'Motivo de la edición',
            maxlength: 500,
          },
          showCancelButton: true,
          confirmButtonText: 'Guardar cambios',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#1A5276',
          cancelButtonColor: '#7f8c8d',
          reverseButtons: true,
          inputValidator: (value) => {
            if (!value || !value.trim()) return 'Debes escribir un comentario.'
            if (value.trim().length < 10) return 'El comentario debe tener al menos 10 caracteres.'
            return null
          },
        })

        if (!reasonResult.isConfirmed) {
          return
        }

        await api.post(`/attendance/sections/${activeId}/set-date`, {
          startDate,
          forceEdit: true,
          reason: reasonResult.value.trim(),
        })

        await Swal.fire({
          icon: 'success',
          title: 'Sesiones actualizadas',
          text: 'La modificación fue guardada con su comentario.',
          confirmButtonColor: '#1A5276',
        })

        setMsg({ type: 'success', text: 'Sesiones actualizadas con justificación.' })
        await loadBoard(activeId)
        await refreshSections()
        return
      }

      await api.post(`/attendance/sections/${activeId}/set-date`, { startDate })

      setMsg({ type: 'success', text: 'Sesiones configuradas correctamente.' })
      await loadBoard(activeId)
      await refreshSections()
    } catch (e) {
      const serverMsg =
        e?.error ||
        e?.message ||
        e?.response?.data?.error ||
        'No se pudieron configurar las sesiones.'

      setMsg({ type: 'error', text: serverMsg })
    } finally {
      setSavingDate(false)
    }
  }

  const configuredCount = useMemo(
    () => sections.filter((s) => (s.classSessions?.length ?? 0) > 0).length,
    [sections]
  )

  const pendingCount = useMemo(
    () => sections.filter((s) => (s.classSessions?.length ?? 0) === 0).length,
    [sections]
  )

  const alreadyConfigured = (board?.sessions?.length ?? 0) > 0

  const sectionOptions = sections.map((s) => ({
    id: s.id,
    label: `${s.course?.code ?? ''}-0${s.sectionNo} — ${s.course?.name ?? 'Sección'}`,
  }))

  return (
    <AppShell navItems={navItems}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', marginBottom: 6 }}>
        Gestión académica
      </h2>

      <p style={{ color: 'var(--stone-400)', fontSize: 14, marginBottom: 28 }}>
        Crea secciones, asigna profesores, inscribe estudiantes y configura las sesiones de clase.
      </p>

      {msg && <AlertMessage msg={msg} onClose={() => setMsg(null)} />}

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <TabButton active={tab === 'secciones'} onClick={() => setTab('secciones')}>
          Secciones
        </TabButton>
        <TabButton active={tab === 'estudiantes'} onClick={() => setTab('estudiantes')}>
          Estudiantes
        </TabButton>
        <TabButton active={tab === 'sesiones'} onClick={() => setTab('sesiones')}>
          Sesiones
        </TabButton>
      </div>

      {loading ? (
        <PageSpinner />
      ) : (
        <>
          {tab === 'secciones' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 20 }}>
              <Card>
                <SectionTitle>Nueva sección</SectionTitle>

                <form onSubmit={handleCreateSection}>
                  <div style={grid2}>
                    <Field label="Materia">
                      <select
                        value={sectionForm.courseId}
                        onChange={(e) => updateSectionForm('courseId', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Seleccione</option>
                        {courses.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} — {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Profesor">
                      <select
                        value={sectionForm.professorId}
                        onChange={(e) => updateSectionForm('professorId', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Seleccione</option>
                        {professors.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.firstName} {p.lastName}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Período">
                      <select
                        value={sectionForm.periodId}
                        onChange={(e) => updateSectionForm('periodId', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Seleccione</option>
                        {periods.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Número de sección">
                      <input
                        type="number"
                        min="1"
                        value={sectionForm.sectionNo}
                        onChange={(e) => updateSectionForm('sectionNo', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Día de clase">
                      <select
                        value={sectionForm.classDay}
                        onChange={(e) => updateSectionForm('classDay', e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">Seleccione</option>
                        <option value="lunes">Lunes</option>
                        <option value="martes">Martes</option>
                        <option value="miércoles">Miércoles</option>
                        <option value="jueves">Jueves</option>
                        <option value="viernes">Viernes</option>
                        <option value="sábado">Sábado</option>
                      </select>
                    </Field>

                    <Field label="Hora inicio">
                      <input
                        type="time"
                        value={sectionForm.startTime}
                        onChange={(e) => updateSectionForm('startTime', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>

                    <Field label="Hora fin">
                      <input
                        type="time"
                        value={sectionForm.endTime}
                        onChange={(e) => updateSectionForm('endTime', e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    <Button type="submit" variant="primary" size="sm" disabled={savingSection}>
                      {savingSection ? 'Guardando…' : 'Crear sección'}
                    </Button>
                  </div>
                </form>
              </Card>

              <Card>
                <SectionTitle>Resumen de secciones</SectionTitle>

                <div style={statsGrid}>
                  <MiniStat label="Total secciones" value={sections.length} color="var(--stone-700)" />
                  <MiniStat label="Configuradas" value={configuredCount} color="var(--green-700)" />
                  <MiniStat label="Pendientes" value={pendingCount} color="var(--gold-500)" />
                </div>

                <div style={{ marginTop: 18 }}>
                  {sections.length === 0 ? (
                    <EmptyState
                      icon="📘"
                      title="Sin secciones"
                      desc="Crea una sección nueva para comenzar."
                    />
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {sections.map((s) => (
                        <div
                          key={s.id}
                          style={{
                            border: '1px solid var(--stone-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            background: activeId === s.id ? 'var(--stone-50)' : '#fff',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            setActiveId(s.id)
                            setTab('estudiantes')
                          }}
                        >
                          <div style={{ fontWeight: 700, color: 'var(--stone-900)' }}>
                            {s.course?.name} — Sección {String(s.sectionNo).padStart(2, '0')}
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--stone-400)', marginTop: 4 }}>
                            Prof. {s.professor?.firstName} {s.professor?.lastName} · {s.period?.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {tab === 'estudiantes' && (
            <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 20 }}>
              <Card>
                <SectionTitle>Seleccionar sección</SectionTitle>

                <Field label="Sección">
                  <select
                    value={activeId}
                    onChange={(e) => setActiveId(e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Seleccione</option>
                    {sectionOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {!activeId ? (
                  <EmptyState icon="📚" title="Sin sección activa" desc="Selecciona una sección." />
                ) : (
                  <>
                    <div style={{ marginTop: 12, fontSize: 13.5, color: 'var(--stone-400)' }}>
                      Marca los estudiantes que deseas inscribir en la sección.
                    </div>

                    <div style={{ marginTop: 16 }}>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveEnrollments}
                        disabled={savingEnrollments}
                      >
                        {savingEnrollments ? 'Guardando…' : 'Guardar estudiantes'}
                      </Button>
                    </div>
                  </>
                )}
              </Card>

              <Card>
                <SectionTitle>Lista de estudiantes</SectionTitle>

                {students.length === 0 ? (
                  <EmptyState
                    icon="👥"
                    title="Sin listado"
                    desc="No se pudieron cargar estudiantes. Debe existir GET /users/students."
                  />
                ) : (
                  <div style={{ display: 'grid', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
                    {students.map((s) => {
                      const checked = selectedStudentIds.includes(s.id)

                      return (
                        <label
                          key={s.id}
                          style={{
                            border: '1px solid var(--stone-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            background: checked ? 'var(--stone-50)' : '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedStudentIds((prev) =>
                                checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                              )
                            }}
                          />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--stone-900)' }}>
                              {s.firstName} {s.lastName}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--stone-400)' }}>
                              {s.institutionalId} · {s.email}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {tab === 'sesiones' && (
            <>
              <Card style={{ marginBottom: 20 }}>
                <div style={statsGrid}>
                  <MiniStat label="Total secciones" value={sections.length} color="var(--stone-700)" />
                  <MiniStat label="Configuradas" value={configuredCount} color="var(--green-700)" />
                  <MiniStat label="Pendientes" value={pendingCount} color="var(--gold-500)" />
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 14,
                    flexWrap: 'wrap',
                    marginTop: 16,
                  }}
                >
                  <div style={{ minWidth: 280, flex: 1 }}>
                    <label style={labelStyle}>Sección</label>
                    <select
                      value={activeId}
                      onChange={(e) => setActiveId(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Seleccione</option>
                      {sectionOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={labelStyle}>Fecha de la 1ª clase</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      style={{ ...inputStyle, width: 'auto' }}
                      disabled={alreadyConfigured && !editingSessions}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {!alreadyConfigured && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSetDate}
                        disabled={!activeId || !startDate || savingDate}
                      >
                        {savingDate ? 'Guardando…' : 'Generar sesiones'}
                      </Button>
                    )}

                    {alreadyConfigured && !editingSessions && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingSessions(true)}
                        disabled={!activeId || savingDate}
                      >
                        Editar sesiones
                      </Button>
                    )}

                    {alreadyConfigured && editingSessions && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handleSetDate}
                          disabled={!activeId || !startDate || savingDate}
                        >
                          {savingDate ? 'Guardando…' : 'Guardar cambios'}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSessions(false)

                            const initial =
                              board?.sessions?.length
                                ? new Date(board.sessions[0].date).toISOString().slice(0, 10)
                                : ''

                            setStartDate(initial)
                          }}
                          disabled={savingDate}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: 13, color: 'var(--stone-400)', margin: '12px 0 0 0' }}>
                  {!alreadyConfigured
                    ? 'Se crearán 4 sesiones semanales a partir de la fecha seleccionada.'
                    : editingSessions
                      ? 'Estás editando una sección ya configurada. Al guardar se solicitará confirmación y comentario obligatorio.'
                      : 'Esta sección ya tiene sesiones generadas. Pulsa "Editar sesiones" para modificarla.'}
                </p>
              </Card>

              {loadingBoard ? (
                <PageSpinner />
              ) : !activeId ? (
                <EmptyState icon="📅" title="Sin sección activa" desc="Selecciona una sección." />
              ) : board ? (
                <Card>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>
                        {board.courseName}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--stone-400)', marginTop: 4 }}>
                        Prof. {board.professor} · {board.period} · {board.students.length} estudiantes
                      </div>
                    </div>

                    <Badge color={(board.sessions?.length ?? 0) > 0 ? 'green' : 'amber'}>
                      {(board.sessions?.length ?? 0) > 0 ? 'Configurada' : 'Pendiente'}
                    </Badge>
                  </div>

                  {(board.sessions?.length ?? 0) === 0 ? (
                    <EmptyState
                      icon="📅"
                      title="Sección sin sesiones"
                      desc="Configura la fecha inicial para habilitar la asistencia."
                    />
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ background: 'var(--stone-100)' }}>
                            <th style={thStyle(true)}>Sesión</th>
                            <th style={thStyle(true)}>Fecha</th>
                            <th style={thStyle(true)}>Horario</th>
                            <th style={thStyle(true)}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {board.sessions.map((sess, i) => (
                            <tr key={sess.id} style={{ background: i % 2 === 0 ? '#fff' : 'var(--stone-50)' }}>
                              <td style={tdStyle(true)}>Sesión {sess.sessionNo}</td>
                              <td style={tdStyle(true)}>
                                {new Date(sess.date).toLocaleDateString('es-DO', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td style={tdStyle(true)}>
                                {formatHour(sess.startAt)} — {formatHour(sess.endAt)}
                              </td>
                              <td style={tdStyle(true)}>
                                <Badge color={sess.status === 'open' ? 'green' : 'stone'}>
                                  {sess.status === 'open' ? 'Activa' : sess.status}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              ) : null}
            </>
          )}
        </>
      )}
    </AppShell>
  )
}

function AlertMessage({ msg, onClose }) {
  return (
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
      <button
        onClick={onClose}
        style={{
          float: 'right',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 700,
          color: 'inherit',
        }}
      >
        ×
      </button>
    </div>
  )
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: active ? '1.5px solid var(--green-700)' : '1.5px solid var(--stone-200)',
        background: active ? 'var(--green-700)' : '#fff',
        color: active ? '#fff' : 'var(--stone-700)',
        padding: '10px 16px',
        borderRadius: 999,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function MiniStat({ label, value, color }) {
  return (
    <div
      style={{
        border: '1px solid var(--stone-200)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 14px',
        background: '#fff',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--stone-400)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20, color }}>{value}</div>
    </div>
  )
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

const grid2 = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 14,
}

const statsGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))',
  gap: 12,
}

const labelStyle = {
  display: 'block',
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--stone-500)',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1.5px solid var(--stone-200)',
  fontSize: 13.5,
  outline: 'none',
  background: '#fff',
  color: 'var(--stone-900)',
}

const thStyle = (left) => ({
  padding: '10px 12px',
  textAlign: left ? 'left' : 'center',
  fontWeight: 600,
  color: 'var(--stone-500)',
  fontSize: 12,
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--stone-200)',
})

const tdStyle = (left) => ({
  padding: '10px 12px',
  textAlign: left ? 'left' : 'center',
  borderBottom: '1px solid var(--stone-100)',
})
