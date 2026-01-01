import crypto from 'crypto'
import { promisify } from 'util'

export type Role = 'manager' | 'driver'

export type Session = {
  sub: string
  role: Role
  issuedAt: number
  expiresAt: number
}

export type AuthCheck =
  | { session: Session; error: null }
  | { session: null; error: 'unauthorized' | 'forbidden' }

export const getAuthError = (error: AuthCheck['error']) => {
  if (!error) return null
  const status = error === 'unauthorized' ? 401 : 403
  const message = error === 'unauthorized' ? 'Unauthorized' : 'Forbidden'
  return { status, message }
}

const SESSION_COOKIE = 'grilled_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const PASSWORD_PREFIX = 'scrypt'
const SALT_BYTES = 16
const KEY_LENGTH = 64
const SECRET =
  process.env.AUTH_SECRET || 'dev-secret-change-me'

const scryptAsync = promisify(crypto.scrypt)

const base64Url = (value: string) =>
  Buffer.from(value, 'utf8').toString('base64url')

const base64UrlDecode = (value: string) =>
  Buffer.from(value, 'base64url').toString('utf8')

const sign = (payload: string) =>
  crypto.createHmac('sha256', SECRET).update(payload).digest('base64url')

const timingSafeEqual = (a: string, b: string) => {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

export const getSessionCookieName = () => SESSION_COOKIE

export const createSessionToken = (role: Role, sub: string) => {
  const issuedAt = Math.floor(Date.now() / 1000)
  const expiresAt = issuedAt + SESSION_TTL_SECONDS
  const payload = base64Url(
    JSON.stringify({ sub, role, issuedAt, expiresAt })
  )
  const signature = sign(payload)
  return `${payload}.${signature}`
}

export const verifySessionToken = (token?: string | null): Session | null => {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  if (!timingSafeEqual(signature, sign(payload))) return null
  try {
    const decoded = JSON.parse(base64UrlDecode(payload)) as Session
    if (!decoded.expiresAt || decoded.expiresAt < Date.now() / 1000) {
      return null
    }
    return decoded
  } catch (error) {
    return null
  }
}

export const parseCookies = (cookieHeader?: string | null) => {
  if (!cookieHeader) return {}
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, item) => {
    const [name, ...rest] = item.trim().split('=')
    if (!name) return acc
    acc[name] = decodeURIComponent(rest.join('='))
    return acc
  }, {})
}

export const getSessionFromRequest = (request: Request) => {
  const cookies = parseCookies(request.headers.get('cookie'))
  return verifySessionToken(cookies[SESSION_COOKIE])
}

export const requireAuth = (
  request: Request,
  roles?: Role[]
): AuthCheck => {
  const session = getSessionFromRequest(request)
  if (!session) {
    return { session: null, error: 'unauthorized' }
  }
  if (roles && !roles.includes(session.role)) {
    return { session: null, error: 'forbidden' }
  }
  return { session, error: null }
}

const buildCookie = (value: string, maxAge: number) => {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return `${SESSION_COOKIE}=${encodeURIComponent(
    value
  )}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secureFlag}`
}

export const applySessionCookie = (
  response: Response,
  token: string
) => {
  response.headers.append(
    'Set-Cookie',
    buildCookie(token, SESSION_TTL_SECONDS)
  )
}

export const clearSessionCookie = (response: Response) => {
  response.headers.append('Set-Cookie', buildCookie('', 0))
}

export const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(SALT_BYTES).toString('hex')
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `${PASSWORD_PREFIX}$${salt}$${derived.toString('hex')}`
}

export const verifyPassword = async (
  password: string,
  stored: string
) => {
  if (!stored.startsWith(`${PASSWORD_PREFIX}$`)) {
    return password === stored
  }
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return timingSafeEqual(derived.toString('hex'), hash)
}

export const needsRehash = (stored: string) =>
  !stored.startsWith(`${PASSWORD_PREFIX}$`)
