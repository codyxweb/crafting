import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { assertSessionSecretConfigured, createSession } from '@/lib/auth';
import { registerSchema } from '@/lib/validation';
import { rateLimitKey, rateLimited, tooManyRequests } from '@/lib/rate-limit';
import { authServerError } from '@/lib/http';
export async function POST(request: Request) {
  if (rateLimited(rateLimitKey(request, 'register'), 5)) return tooManyRequests();
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error:'Please check your details and try again.' }, { status:400 });
    assertSessionSecretConfigured();
    const email = parsed.data.email.toLowerCase();
    if (await db.user.findUnique({ where:{ email } })) return NextResponse.json({ error:'An account with this email already exists.' }, { status:409 });
    const user = await db.user.create({ data:{ name:parsed.data.name, email, passwordHash:await bcrypt.hash(parsed.data.password, 12), cart:{ create:{} } }, select:{ id:true, role:true } });
    await createSession({ id:user.id, role:user.role });
    return NextResponse.json({ ok:true }, { status:201 });
  } catch (cause) { return authServerError(cause); }
}
