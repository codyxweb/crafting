import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export function assertSessionSecretConfigured() {
  const value = process.env.SESSION_SECRET;
  if (!value && process.env.NODE_ENV === 'production') throw new Error('SESSION_SECRET is required in production.');
}
function sessionSecret() {
  assertSessionSecretConfigured();
  return new TextEncoder().encode(process.env.SESSION_SECRET || 'development-only-change-this-secret-at-least-32-chars');
}
export type Session = { id: string; role: 'CUSTOMER' | 'ADMIN' };
export async function createSession(payload: Session) {
  const token = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('7d').sign(sessionSecret());
  cookies().set('seyora_session', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 });
}
export async function getSession(): Promise<Session | null> {
  const token = cookies().get('seyora_session')?.value;
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, sessionSecret()); return payload.id && payload.role ? { id: String(payload.id), role: payload.role as Session['role'] } : null; } catch { return null; }
}
export async function requireUser(admin = false) {
  const session = await getSession();
  if (!session || (admin && session.role !== 'ADMIN')) return null;
  return session;
}
export async function requireAdmin() { const session = await getSession(); return session?.role === 'ADMIN' ? session : null; }
