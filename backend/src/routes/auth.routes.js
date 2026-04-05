import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server'
import prisma from '../lib/prisma.js'
import { requireAuth } from '../middlewares/auth.middleware.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Espera 15 minutos.' },
})

// ── helpers ───────────────────────────────────────────────────────────────────
function makeAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role?.name ?? user.role, institutionalId: user.institutionalId },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES ?? '15m' }
  )
}

async function makeRefreshToken(userId, req) {
  const raw = crypto.randomBytes(64).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const exp = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hash,
      deviceInfo: req.headers['user-agent']?.slice(0, 200),
      ipAddress: req.ip,
      expiresAt: exp,
    },
  })

  return raw
}

async function getUserWithRole(id) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true, career: true, department: true },
  })
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { identifier, password } = req.body
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Campos requeridos' })
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { institutionalId: identifier }] },
      include: { role: true },
    })

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000)
      return res.status(423).json({ error: `Cuenta bloqueada. Intenta en ${mins} min.` })
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: attempts, lockedUntil, lastLoginAt: new Date() },
      })

      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    })

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'LOGIN_PASSWORD', ipAddress: req.ip },
    })

    const accessToken = makeAccessToken(user)
    const refreshToken = await makeRefreshToken(user.id, req)
    const full = await getUserWithRole(user.id)

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: full.id,
        institutionalId: full.institutionalId,
        firstName: full.firstName,
        lastName: full.lastName,
        email: full.email,
        role: full.role.name,
        mustChangePassword: full.mustChangePassword,
        department: full.department?.name,
        career: full.career?.name,
      },
    })
  } catch (e) {
    next(e)
  }
})

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ error: 'Token requerido' })
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
    const token = await prisma.refreshToken.findFirst({ where: { tokenHash: hash } })

    if (!token || token.revoked || token.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token inválido' })
    }

    await prisma.refreshToken.update({ where: { id: token.id }, data: { revoked: true } })

    const user = await prisma.user.findUnique({
      where: { id: token.userId },
      include: { role: true },
    })

    const accessToken = makeAccessToken(user)
    const newRefresh = await makeRefreshToken(user.id, req)

    res.json({ accessToken, refreshToken: newRefresh })
  } catch (e) {
    next(e)
  }
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hash },
        data: { revoked: true },
      })
    }
    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { role: true, career: true, department: true },
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    res.json({
      id: user.id,
      institutionalId: user.institutionalId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      mustChangePassword: user.mustChangePassword,
      department: user.department?.name,
      career: user.career?.name,
    })
  } catch (e) {
    next(e)
  }
})

// ── WebAuthn ──────────────────────────────────────────────────────────────────
const challenges = new Map()

router.post('/webauthn/register/options', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } })

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const existing = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id, isActive: true },
    })

    const options = await generateRegistrationOptions({
      rpName: process.env.RP_NAME ?? 'UAFAM',
      rpID: process.env.RP_ID ?? 'localhost',
      userID: user.id,
      userName: user.institutionalId,
      userDisplayName: `${user.firstName} ${user.lastName}`,
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        type: 'public-key',
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
    })

    challenges.set(user.id, options.challenge)
    res.json(options)
  } catch (e) {
    next(e)
  }
})

router.post('/webauthn/register/verify', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } })
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const challenge = challenges.get(user.id)
    if (!challenge) {
      return res.status(400).json({ error: 'Challenge expirado' })
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: challenge,
      expectedOrigin: process.env.ORIGIN ?? 'http://localhost:5173',
      expectedRPID: process.env.RP_ID ?? 'localhost',
      requireUserVerification: false,
    })

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verificación fallida' })
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      aaguid,
      credentialDeviceType,
    } = verification.registrationInfo

    await prisma.webAuthnCredential.create({
      data: {
        userId: user.id,
        credentialId: Buffer.from(credentialID).toString('base64url'),
        publicKey: Buffer.from(credentialPublicKey),
        signCount: counter,
        aaguid,
        deviceType: credentialDeviceType,
        friendlyName: req.body.friendlyName ?? 'Mi dispositivo',
      },
    })

    challenges.delete(user.id)

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'WEBAUTHN_REGISTER' },
    })

    res.json({ verified: true })
  } catch (e) {
    next(e)
  }
})

router.post('/webauthn/authenticate/options', async (req, res, next) => {
  try {
    const { identifier } = req.body ?? {}

    // Flujo discoverable: sin identifier
    if (!identifier) {
      const options = await generateAuthenticationOptions({
        rpID: process.env.RP_ID ?? 'localhost',
        allowCredentials: [],
        userVerification: 'preferred',
      })

      challenges.set('discoverable', options.challenge)
      return res.json({ ...options, userId: null })
    }

    // Flujo normal: con email o matrícula
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { institutionalId: identifier },
        ],
      },
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const creds = await prisma.webAuthnCredential.findMany({
      where: { userId: user.id, isActive: true },
    })

    if (!creds.length) {
      return res.status(404).json({
        error: 'El usuario no tiene credenciales biométricas registradas.',
      })
    }

    const options = await generateAuthenticationOptions({
      rpID: process.env.RP_ID ?? 'localhost',
      allowCredentials: creds.map((c) => ({
        id: c.credentialId,
        type: 'public-key',
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    })

    challenges.set(user.id, options.challenge)
    return res.json({ ...options, userId: user.id })
  } catch (e) {
    next(e)
  }
})

router.post('/webauthn/authenticate/verify', async (req, res, next) => {
  try {
    const { userId, _attendanceOnly, ...body } = req.body
    const credId = body.id

    if (!credId) {
      return res.status(400).json({ error: 'Credencial no enviada' })
    }

    const cred = await prisma.webAuthnCredential.findFirst({
      where: { credentialId: credId, isActive: true },
    })

    if (!cred) {
      return res.status(404).json({ error: 'Credencial no encontrada' })
    }

    const resolvedUserId = userId ?? cred.userId

    const user = await prisma.user.findUnique({
      where: { id: resolvedUserId },
      include: { role: true },
    })

    if (!user) {
      return res.status(400).json({ error: 'Usuario no encontrado' })
    }

    const challenge =
      challenges.get(resolvedUserId) ?? challenges.get('discoverable')

    if (!challenge) {
      return res.status(400).json({ error: 'Challenge inválido o expirado' })
    }

    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge: challenge,
      expectedOrigin: process.env.ORIGIN ?? 'http://localhost:5173',
      expectedRPID: process.env.RP_ID ?? 'localhost',
      authenticator: {
        credentialID: Buffer.from(cred.credentialId, 'base64url'),
        credentialPublicKey: cred.publicKey,
        counter: cred.signCount,
      },
      requireUserVerification: false,
    })

    if (!verification.verified) {
      return res.status(400).json({ error: 'Verificación fallida' })
    }

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: {
        signCount: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: _attendanceOnly ? 'ATTENDANCE_BIOMETRIC_VERIFY' : 'LOGIN_BIOMETRIC',
        ipAddress: req.ip,
      },
    })

    challenges.delete(resolvedUserId)
    challenges.delete('discoverable')

    if (_attendanceOnly) {
      return res.json({ verified: true, userId: user.id })
    }

    const accessToken = makeAccessToken(user)
    const refreshToken = await makeRefreshToken(user.id, req)
    const full = await getUserWithRole(user.id)

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: full.id,
        institutionalId: full.institutionalId,
        firstName: full.firstName,
        lastName: full.lastName,
        email: full.email,
        role: full.role.name,
        mustChangePassword: full.mustChangePassword,
        department: full.department?.name,
        career: full.career?.name,
      },
    })
  } catch (e) {
    next(e)
  }
})

router.get('/webauthn/credentials', requireAuth, async (req, res, next) => {
  try {
    const creds = await prisma.webAuthnCredential.findMany({
      where: { userId: req.user.sub, isActive: true },
      select: {
        id: true,
        friendlyName: true,
        deviceType: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })

    res.json(creds)
  } catch (e) {
    next(e)
  }
})

router.delete('/webauthn/credentials/:id', requireAuth, async (req, res, next) => {
  try {
    const cred = await prisma.webAuthnCredential.findFirst({
      where: { id: req.params.id, userId: req.user.sub },
    })

    if (!cred) {
      return res.status(404).json({ error: 'Credencial no encontrada' })
    }

    await prisma.webAuthnCredential.update({
      where: { id: cred.id },
      data: { isActive: false },
    })

    res.json({ ok: true })
  } catch (e) {
    next(e)
  }
})

export default router