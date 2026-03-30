// src/App.jsx
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth }   from './context/AuthContext.jsx'

import LoginPage                from './pages/LoginPage.jsx'
import SetupBiometrico          from './pages/SetupBiometrico.jsx'
import DashboardEstudiante      from './pages/DashboardEstudiante.jsx'
import AsistenciaEstudiante     from './pages/AsistenciaEstudiante.jsx'
import CalificacionesEstudiante from './pages/CalificacionesEstudiante.jsx'
import DashboardProfesor        from './pages/DashboardProfesor.jsx'
import AsistenciaProfesor       from './pages/AsistenciaProfesor.jsx'
import CalificacionesProfesor   from './pages/CalificacionesProfesor.jsx'
import DashboardRegistro        from './pages/DashboardRegistro.jsx'
import CalificacionesRegistro   from './pages/CalificacionesRegistro.jsx'
import ExportarSIA              from './pages/ExportarSIA.jsx'
import Reportes                from './pages/Reportes.jsx'

function Spinner() {
  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--stone-100)' }}>
      <div style={{ width:40, height:40, borderRadius:'50%', border:'3px solid var(--green-200)', borderTopColor:'var(--green-700)', animation:'spinRing .8s linear infinite' }} />
    </div>
  )
}

function RoleRouter() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />
  const role = user.role?.name ?? user.role
  if (role === 'estudiante') return <Navigate to="/estudiante"  replace />
  if (role === 'profesor')   return <Navigate to="/profesor"    replace />
  if (role === 'registro')   return <Navigate to="/registro"    replace />
  return <Navigate to="/login" replace />
}

function Guard({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />
  const role = user.role?.name ?? user.role
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/"      element={<RoleRouter />} />

        {/* Estudiante */}
        <Route path="/estudiante" element={<Guard roles={['estudiante']}><DashboardEstudiante /></Guard>} />
        <Route path="/estudiante/asistencia"     element={<Guard roles={['estudiante']}><AsistenciaEstudiante /></Guard>} />
        <Route path="/estudiante/calificaciones" element={<Guard roles={['estudiante']}><CalificacionesEstudiante /></Guard>} />

        {/* Profesor */}
        <Route path="/profesor" element={<Guard roles={['profesor']}><DashboardProfesor /></Guard>} />
        <Route path="/profesor/asistencia"    element={<Guard roles={['profesor']}><AsistenciaProfesor /></Guard>} />
        <Route path="/profesor/calificaciones" element={<Guard roles={['profesor']}><CalificacionesProfesor /></Guard>} />

        {/* Registro */}
        <Route path="/registro" element={<Guard roles={['registro']}><DashboardRegistro /></Guard>} />
        <Route path="/registro/calificaciones" element={<Guard roles={['registro']}><CalificacionesRegistro /></Guard>} />
        <Route path="/registro/reportes"       element={<Guard roles={['registro']}><Reportes /></Guard>} />
        <Route path="/exportar-sia"            element={<Guard roles={['registro']}><ExportarSIA /></Guard>} />

        {/* Shared */}
        <Route path="/configurar-biometria" element={<Guard roles={['estudiante','profesor','registro']}><SetupBiometrico /></Guard>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
