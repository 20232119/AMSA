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
 
 1. Lista de asistencia necesita mas opciones, like: presente, ausente, excusado, etc.
 2. Mejoras: tareas pendientes por materia y cuando se acceda, va a presentar las asignaciones pendientes que se         tienen   y yo hacerlas, se auto completan.
 3. Customize el dashboard
 4. UI/UX


Filtrar las carreras y de ahi las materias y profesores segun el ciclo
arreglar codigo
dividir los styles de la logica
validar campos, que no se pongan letras o numeros donde no deberian and que no 
se pase del limite, por ejemplo, que si es 25, que sea 25 y no 25.1
que se guarde cuando salgo de la pantalla y este ahi cuando regreso
quiero que cuando yo ponga la biometria en una clase de sesion, se me marque como presente
sessions cant be fixed
no tiene sentidp que se ponga asistencia a un estudiante que no este con biometria
No poder escribir si el estudiante es retirado
 ```