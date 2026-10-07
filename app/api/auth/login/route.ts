import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { assertSessionSecretConfigured, createSession } from '@/lib/auth';
import { loginSchema } from '@/lib/validation';
import { rateLimitKey, rateLimited, tooManyRequests } from '@/lib/rate-limit';
import { authServerError } from '@/lib/http';
export async function POST(request: Request) {
  if (rateLimited(rateLimitKey(request, 'login'), 8)) return tooManyRequests();
  try {
    const parsed = loginSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error:'Enter a valid email and password.' }, { status:400 });
    assertSessionSecretConfigured();
    const user = await db.user.findUnique({ where:{ email:parsed.data.email.toLowerCase() } });
    if (!user || !await bcrypt.compare(parsed.data.password, user.passwordHash)) return NextResponse.json({ error:'Email or password is incorrect.' }, { status:401 });
    await createSession({ id:user.id, role:user.role });
    return NextResponse.json({ ok:true });
  } catch (cause) { return authServerError(cause); }
}
