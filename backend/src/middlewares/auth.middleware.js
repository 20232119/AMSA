// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token requerido' })
    }

    const token = header.slice(7)

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET)

    // Normalizar estructura del usuario
    req.user = {
      ...decoded,
      role: decoded.role?.name ?? decoded.role,
    }

    next()
  } catch (err) {
    return res.status(401).json({
      error: 'Token inválido o expirado',
    })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const allowedRoles = roles.flat()

    const userRole = req.user?.role

    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Sin permisos',
      })
    }

    next()
  }
}