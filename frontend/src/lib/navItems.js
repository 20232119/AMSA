// src/lib/navItems.js
import {
  HomeIcon,
  BookIcon,
  UsersIcon,
  ChartIcon,
  CalendarIcon,
  UploadIcon,
  FingerprintIcon,
} from '../components/ui.jsx'
import { createElement as h } from 'react'

export function navForRole(role) {
  if (role === 'estudiante') return [
    { path:'/estudiante',                label:'Inicio',              icon: h(HomeIcon,     { size:18 }), end:true },
    { path:'/estudiante/asistencia',     label:'Mi asistencia',       icon: h(CalendarIcon, { size:18 }) },
    { path:'/estudiante/calificaciones', label:'Calificaciones',      icon: h(BookIcon,     { size:18 }) },
  ]

  if (role === 'profesor') return [
    { path:'/profesor',                  label:'Inicio',              icon: h(HomeIcon,     { size:18 }), end:true },
    { path:'/profesor/asistencia',       label:'Asistencia',          icon: h(CalendarIcon, { size:18 }) },
    { path:'/profesor/calificaciones',   label:'Calificaciones',      icon: h(BookIcon,     { size:18 }) },
  ]

  if (role === 'registro') return [
    { path:'/registro',                  label:'Inicio',              icon: h(HomeIcon,     { size:18 }), end:true },
    { path:'/registro/configuracion',    label:'Gestión académica',   icon: h(UsersIcon,    { size:18 }) },
    { path:'/registro/calificaciones',   label:'Calificaciones',      icon: h(BookIcon,     { size:18 }) },
    { path:'/registro/reportes',         label:'Reportes',            icon: h(ChartIcon,    { size:18 }) },
  ]

  return []
}