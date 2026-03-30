// src/middlewares/auth.middleware.js
import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Token requerido'); err.status = 401; return next(err)
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET)
    next()
  } catch {
    const err = new Error('Token inválido o expirado'); err.status = 401; throw err
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    const flat = roles.flat()
    if (!flat.includes(req.user?.role)) {
      const err = new Error('Sin permisos'); err.status = 403; return next(err)
    }
    next()
  }
}
