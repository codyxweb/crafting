import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
export function error(message = 'Something went wrong. Please try again.', status = 400) { return NextResponse.json({ error: message }, { status }); }
export function serverError(cause: unknown) { console.error('API request failed:', cause); return error('Something went wrong. Please try again.', 500); }
export function authServerError(cause: unknown) {
  console.error('Authentication request failed:', cause);
  if (cause instanceof Prisma.PrismaClientKnownRequestError) {
    const detail = `${cause.message} ${String(cause.meta?.message ?? '')}`;
    const unavailable = ['P1001', 'P1002', 'P1008', 'P1017'].includes(cause.code)
      || (cause.code === 'P2010' && /server selection timeout|no available servers|replicasetnop|transactions are not supported/i.test(detail));
    if (unavailable) {
      return NextResponse.json(
        { error: 'Account services are temporarily unavailable. Please wait a moment and try again.' },
        { status: 503, headers: { 'Retry-After': '30' } },
      );
    }
  }
  return error('Something went wrong. Please try again.', 500);
}
export function unauthorized() { return error('Please sign in to continue.', 401); }
export function forbidden() { return error('You do not have permission to do that.', 403); }
