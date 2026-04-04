# UAFAM — Sistema de Asistencia Biométrica y Gestión Académica

## Estructura del proyecto

```
uafam/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── index.js
│   │   ├── lib/prisma.js
│   │   ├── middlewares/auth.middleware.js
│   │   └── routes/
│   │       ├── auth.routes.js       Sprint 1 — Auth + WebAuthn
│   │       ├── user.routes.js
│   │       ├── section.routes.js
│   │       ├── attendance.routes.js  Sprint 2 — Asistencia biométrica
│   │       ├── grade.routes.js       Sprint 3 — Calificaciones
│   │       └── export.routes.js      Sprint 4 — XLSX export
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── lib/api.js
    │   ├── lib/navItems.js
    │   ├── components/
    │   │   ├── AppShell.jsx
    │   │   └── ui.jsx
    │   ├── pages/
    │   │   ├── LoginPage.jsx
    │   │   ├── SetupBiometrico.jsx
    │   │   ├── DashboardEstudiante.jsx
    │   │   ├── AsistenciaEstudiante.jsx
    │   │   ├── CalificacionesEstudiante.jsx
    │   │   ├── DashboardProfesor.jsx
    │   │   ├── AsistenciaProfesor.jsx
    │   │   ├── CalificacionesProfesor.jsx
    │   │   ├── DashboardRegistro.jsx
    │   │   ├── CalificacionesRegistro.jsx
    │   │   └── ExportarSIA.jsx
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Setup rápido

### 1. Base de datos

Crea una base de datos PostgreSQL llamada `uafam_db` en pgAdmin o psql:
```sql
CREATE DATABASE uafam_db;
```

### 2. Backend

```bash
cd backend

# Copia y edita las variables de entorno
cp .env.example .env
# Edita DATABASE_URL con tus credenciales de PostgreSQL

# Instala dependencias
npm install

# Crea las tablas
npm run db:push

# Carga datos de prueba
npm run db:seed

# Inicia el servidor
npm run dev
```

### 3. Frontend

```bash
cd frontend

# Instala dependencias (incluye @simplewebauthn/browser)
npm install @simplewebauthn/browser
npm install

# Inicia el servidor de desarrollo
npm run dev
```

### 4. Abre en el navegador

- Frontend: http://localhost:5173
- Backend:  http://localhost:3000

---

## Usuarios de prueba

| Rol        | Matrícula  | Contraseña |
|------------|------------|------------|
| Estudiante | 2025-0001  | Test1234!  |
| Profesor   | EMP-0042   | Test1234!  |
| Registro   | REG-0005   | Test1234!  |

---

## Sprints implementados

| Sprint | Módulo                   | Estado |
|--------|--------------------------|--------|
| 1      | Auth + JWT + WebAuthn    | ✅     |
| 2      | Asistencia biométrica    | ✅     |
| 3      | Calificaciones           | ✅     |
| 4      | Exportación XLSX         | ✅     |
| 5      | Reportes académicos      | 🔜     |

---

## Flujo de calificaciones

```
Profesor ingresa notas (borrador)
        ↓
Profesor envía a Registro (enviado)
        ↓
Registro valida nota por nota (validado)
        ↓
Registro publica todas las validadas (publicado)
        ↓
Estudiante puede ver sus notas
```

## Flujo de asistencia

```
Profesor abre sesión de clase
        ↓
Sistema pre-crea registros "ausente" para todos
        ↓
Estudiante registra asistencia con biometría
  (huella / Face ID via WebAuthn)
        ↓
Profesor puede marcar manualmente
        ↓
Profesor cierra sesión (ausentes quedan como ausentes)
```

## Mejoras 
 ```
 
 ## 🚀 Mejoras pendientes

### 📚 Funcionalidades
- Tareas pendientes por materia con autocompletado al realizarlas.
- Personalización del dashboard según el usuario.
- Filtrado de carreras, materias y profesores según el ciclo académico.
- Guardado automático de datos al salir de una pantalla.

### ⚙️ Lógica académica
- Integración de asistencia automática mediante biometría.
- No permitir asistencia sin registro biométrico válido.
- Permitir edición manual de asistencia solo en caso de fallos del sistema biométrico.
- Detectar inconsistencias entre asistencia manual del profesor y registro biométrico.
- Bloquear edición de datos para estudiantes retirados.
- Corrección del manejo de sesiones.

### 🧪 Validaciones
- Validar tipos de datos en los campos (números, textos, etc.).
- Respetar límites de calificaciones (ej: máximo 25, no permitir 25.1).

### 🧱 Mejora técnica
- Refactorización y limpieza del código.
- Separación de estilos y lógica.
- Mejora general de la estructura del proyecto.

### 🎨 UI/UX
- Mejoras en la interfaz para una experiencia más clara e intuitiva. 
- Mejoras en la presentación de los datos, como poner la descarga de reportes en reportes.
- Mejoras en la navegación y organización de la interfaz, y los colores.
- Poner logo.

### 📝 Documentación
- Documentación de cómo instalar y configurar el proyecto.'