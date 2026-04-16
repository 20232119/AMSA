# UAFAM — Sistema de Asistencia Biométrica y Gestión Académica

Sistema web universitario para gestionar asistencia biométrica, calificaciones y secciones académicas. Construido con **Node.js + Express + Prisma** en el backend y **React + Vite** en el frontend.

---

## Estructura del proyecto

```
uafam/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Modelos de base de datos
│   │   └── seed.js             # Datos de prueba
│   ├── src/
│   │   ├── index.js            # Entrada del servidor
│   │   ├── lib/prisma.js       # Cliente de Prisma
│   │   ├── middlewares/
│   │   │   └── auth.middleware.js
│   │   └── routes/
│   │       ├── auth.routes.js       # Autenticación + WebAuthn
│   │       ├── user.routes.js       # Gestión de usuarios
│   │       ├── section.routes.js    # Secciones académicas
│   │       ├── attendance.routes.js # Asistencia biométrica
│   │       ├── grade.routes.js      # Calificaciones
│   │       └── export.routes.js     # Exportación XLSX
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── context/AuthContext.jsx
    │   ├── lib/
    │   │   ├── api.js           # Cliente HTTP centralizado
    │   │   └── navItems.js      # Navegación por rol
    │   ├── components/
    │   │   ├── AppShell.jsx
    │   │   └── ui.jsx           # Componentes reutilizables
    │   └── pages/
    │       ├── LoginPage.jsx
    │       ├── SetupBiometrico.jsx
    │       ├── DashboardEstudiante.jsx
    │       ├── AsistenciaEstudiante.jsx
    │       ├── CalificacionesEstudiante.jsx
    │       ├── DashboardProfesor.jsx
    │       ├── AsistenciaProfesor.jsx
    │       ├── CalificacionesProfesor.jsx
    │       ├── DashboardRegistro.jsx
    │       ├── GestionAcademica.jsx
    │       ├── CalificacionesRegistro.jsx
    │       └── ExportarSIA.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Requisitos previos

Antes de instalar, asegúrate de tener:

- [Node.js](https://nodejs.org/) v18 o superior
- [PostgreSQL](https://www.postgresql.org/) v14 o superior
- [pgAdmin](https://www.pgadmin.org/) (opcional, para gestionar la base de datos visualmente)
- Un navegador moderno compatible con WebAuthn (Chrome, Edge, Safari, Firefox)

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/uafam.git
cd uafam
```

### 2. Crear la base de datos

Abre pgAdmin o psql y ejecuta:

```sql
CREATE DATABASE uafam_db;
```

### 3. Configurar el backend

```bash
cd backend

# Copia el archivo de variables de entorno
cp .env.example .env
```

Abre el archivo `.env` y edita las siguientes variables:

```env
DATABASE_URL="postgresql://postgres:tu_contraseña@localhost:5432/uafam_db"
JWT_SECRET="una_clave_secreta_larga_y_segura"
JWT_REFRESH_SECRET="otra_clave_secreta_diferente"
PORT=3000
```

Luego instala dependencias, crea las tablas y carga los datos de prueba:

```bash
npm install

# Crea las tablas en la base de datos
npm run db:push

# Carga usuarios y datos de prueba
npm run db:seed

# Inicia el servidor
npm run dev
```

El backend quedará corriendo en: **http://localhost:3000**

### 4. Configurar el frontend

```bash
cd ../frontend

# Instala dependencias base
npm install

# Instala dependencias adicionales requeridas
npm install sweetalert2
npm install @simplewebauthn/browser

# Inicia el servidor de desarrollo
npm run dev
```

El frontend quedará disponible en: **http://localhost:5173**

---

## Usuarios de prueba

Una vez ejecutado el seed, puedes iniciar sesión con los siguientes usuarios:

| Rol        | Matrícula | Contraseña |
|------------|-----------|------------|
| Estudiante | 2025-0001 | Test1234!  |
| Profesor   | EMP-0042  | Test1234!  |
| Registro   | REG-0005  | Test1234!  |

---

## Sprints implementados

| Sprint | Módulo                | Estado |
|--------|-----------------------|--------|
| 1      | Auth + JWT + WebAuthn | ✅     |
| 2      | Asistencia biométrica | ✅     |
| 3      | Calificaciones        | ✅     |
| 4      | Exportación XLSX      | ✅     |
| 5      | Reportes académicos   | 🔜     |

---

## Flujos del sistema

### Calificaciones

```
Profesor ingresa notas → estado: borrador
        ↓
Profesor envía a Registro → estado: enviado
        ↓
Registro valida nota por nota → estado: validado
        ↓
Registro publica todas las validadas → estado: publicado
        ↓
Estudiante puede ver sus calificaciones finales
```

### Asistencia

```
Registro configura las sesiones de clase (fechas y horarios)
        ↓
Profesor abre la sesión del día
        ↓
Sistema pre-crea registros "ausente" para todos los inscritos
        ↓
Estudiante registra su asistencia con biometría (WebAuthn)
        ↓
Profesor puede corregir manualmente si hay fallos biométricos
        ↓
Profesor cierra la sesión — los ausentes quedan registrados
```

---

## Mejoras pendientes

### Funcionalidades
- Personalización del dashboard por usuario
- Filtrado de materias, profesores y carreras según el ciclo académico activo
- Creación de nuevas entidades desde la interfaz: materias, profesores, períodos y estudiantes

### Lógica académica
- Asistencia automática exclusivamente mediante biometría válida
- Bloqueo de edición manual salvo fallo documentado del sistema biométrico
- Detección de inconsistencias entre asistencia manual y registro biométrico
- Bloquear cualquier modificación de datos para estudiantes retirados
- Validación de horarios de sesiones (no permitir inicio antes de las 3:00 p.m. ni después de las 8:00 p.m.)
- Corrección del manejo de sesiones abiertas simultáneas

### Validaciones
- Límites estrictos de calificaciones (ej: máximo 25 puntos, no aceptar 25.1)
- Validación de tipos de datos en todos los formularios

### UI/UX
- Confirmación con SweetAlert2 en todas las acciones destructivas (incluyendo eliminación de huella)
- Mejoras generales de interfaz: colores, navegación y organización
- Mover la descarga de reportes a la sección de Reportes
- Validación visual al seleccionar la fecha de inicio de sesiones

### Técnico
- Refactorización y limpieza del código
- Separación de estilos y lógica de negocio
- Envío de correo electrónico cuando las calificaciones son publicadas

---

## Solución de problemas frecuentes

**Error EPERM en Windows al correr `prisma generate`**
Detén todos los procesos Node activos antes de correr el comando:
```bash
taskkill /F /IM node.exe
npx prisma generate
```
