import { createHash, createHmac, randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'

const authUrl = process.env.SUPABASE_AUTH_URL || 'http://127.0.0.1:35432'
const restUrl = process.env.SUPABASE_REST_URL || 'http://127.0.0.1:35433'
const emailFor = (login: string) => `${login}@accounts.fongrob.invalid`

function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  try {
    const line = readFileSync('deploy/.env', 'utf8').split('\n').find(line => line.startsWith('JWT_SECRET='))
    return line?.slice('JWT_SECRET='.length)
  } catch { return undefined }
}
function serviceToken(secret: string) {
  const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const body = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ role: 'service_role', iss: 'fongrob-admin', aud: 'authenticated', iat: now, exp: now + 300 })}`
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`
}
async function authorized(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return null
  const response = await fetch(`${authUrl}/user`, { headers: { authorization: `Bearer ${token}`, apikey: token }, cache: 'no-store' })
  return response.ok ? token : null
}
async function rpc(token: string, name: string, body: object) {
  return fetch(`${restUrl}/rpc/${name}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, apikey: token, 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
}
export async function GET(request: Request) {
  const token = await authorized(request)
  if (!token) return Response.json({ error: 'Требуется вход.' }, { status: 401 })
  const response = await rpc(token, 'admin_users', {})
  if (!response.ok) return Response.json({ error: response.status === 403 ? 'Доступ только для администратора.' : 'Не удалось загрузить пользователей.' }, { status: response.status === 403 ? 403 : 502 })
  return Response.json(await response.json(), { headers: { 'cache-control': 'no-store' } })
}
export async function POST(request: Request) {
  const token = await authorized(request)
  if (!token) return Response.json({ error: 'Требуется вход.' }, { status: 401 })
  const secret = jwtSecret()
  if (!secret) return Response.json({ error: 'JWT_SECRET не настроен на сервере.' }, { status: 503 })
  let input: { login?: string; password?: string; name?: string }
  try { input = await request.json() } catch { return Response.json({ error: 'Неверные данные.' }, { status: 400 }) }
  const login = input.login?.trim().toLowerCase() || ''
  const name = input.name?.trim() || ''
  const password = input.password || ''
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(login) || name.length < 1 || name.length > 80 || password.length < 5)
    return Response.json({ error: 'Проверьте логин, имя и пароль (не менее 5 символов).' }, { status: 400 })
  const invite = randomBytes(32).toString('hex')
  const invitation = await rpc(token, 'admin_invite', { p_login: login, p_token_hash: createHash('sha256').update(invite).digest('hex') })
  if (!invitation.ok) return Response.json({ error: invitation.status === 403 ? 'Доступ только для администратора.' : 'Логин занят или не удалось создать приглашение.' }, { status: invitation.status === 403 ? 403 : 400 })
  const adminToken = serviceToken(secret)
  const created = await fetch(`${authUrl}/admin/users`, { method: 'POST', headers: { authorization: `Bearer ${adminToken}`, apikey: adminToken, 'content-type': 'application/json' }, body: JSON.stringify({ email: emailFor(login), password, email_confirm: true, user_metadata: { display_name: name, invitation: invite } }), cache: 'no-store' })
  if (!created.ok) return Response.json({ error: 'Сервис входа не смог создать пользователя.' }, { status: 502 })
  return Response.json({ login, name }, { status: 201 })
}
