'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './auth-form.module.css';

export function AuthForm({ mode, title }: { mode: 'login' | 'register'; title: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setTimeout(() => setRetryAfter((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [retryAfter]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || retryAfter > 0) return;
    setBusy(true);
    setMessage('');

    const fields = new FormData(event.currentTarget);
    const payload: Record<string, FormDataEntryValue> = {
      email: fields.get('email') ?? '',
      password: fields.get('password') ?? '',
    };
    if (mode === 'register') payload.name = fields.get('name') ?? '';

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 429) setRetryAfter(Number(response.headers.get('Retry-After')) || 60);
        throw new Error(result.error || 'Please try again.');
      }

      const next = new URLSearchParams(window.location.search).get('next');
      const destination = next?.startsWith('/') && !next.startsWith('//') ? next : '/account';
      window.location.assign(destination);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'We couldn’t reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`form-panel account-form ${styles.form}`}>
      <p className="eyebrow">{mode === 'login' ? 'YOUR SEYORA, YOUR WAY' : 'A LITTLE PLACE OF YOUR OWN'}</p>
      <h2>{title}</h2>
      <p className={styles.intro}>
        {mode === 'login'
          ? 'Sign in to see your orders, saved pieces and account details.'
          : 'Create an account to keep your orders and favourite pieces together.'}
      </p>
      <form onSubmit={submit}>
        {mode === 'register' && <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder="Your full name" /></label>}
        <label>Email address<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" /></label>
        <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} maxLength={100} required placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} /></label>
        <button className="button dark full" disabled={busy || retryAfter > 0}>
          {busy ? 'PLEASE WAIT…' : retryAfter > 0 ? `TRY AGAIN IN ${retryAfter}S` : mode === 'login' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
        {message && <p className={styles.message} role="alert">{message}</p>}
      </form>
      <p className={styles.switch}>
        {mode === 'login' ? 'New to Seyora?' : 'Already have an account?'}{' '}
        <Link href={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'Create an account' : 'Sign in'}</Link>
      </p>
    </div>
  );
}
