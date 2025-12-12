// app/auth/[mode]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthPage() {
  const router = useRouter();
  const { mode } = useParams(); // 👈 This reads /auth/signin or /auth/signup

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        router.push('/portfolio');
      }
    };
    checkSession();
  }, [router]);

  // Validate form
  const validate = () => {
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email.' });
      return false;
    }
    if (!password) {
      setMessage({ type: 'error', text: 'Password is required.' });
      return false;
    }
    if (mode === 'signup' && password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!validate()) return;

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMessage({
          type: 'success',
          text: 'Account created! Check your email for confirmation.',
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/portfolio');
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === 'signin';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{isSignIn ? 'Sign In' : 'Create Account'}</h1>
        <p style={styles.subtitle}>
          {isSignIn
            ? 'Welcome back! Please sign in to continue.'
            : 'Join to manage your portfolio and content.'}
        </p>

        {message && (
          <div style={message.type === 'error' ? styles.alertError : styles.alertSuccess}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={styles.input}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={styles.input}
              disabled={loading}
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required
            />
            {isSignIn && (
              <button
                type="button"
                onClick={() => alert('Password reset not implemented yet')}
                style={styles.forgotPassword}
              >
                Forgot password?
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonLoading : {}),
            }}
          >
            {loading ? 'Processing...' : isSignIn ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={styles.footer}>
          {isSignIn ? (
            <>
              Don’t have an account?{' '}
              <a
                href="/auth/signup"
                style={styles.link}
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/auth/signup');
                }}
              >
                Sign up
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a
                href="/auth/signin"
                style={styles.link}
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/auth/signin');
                }}
              >
                Sign in
              </a>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background-color: #f9fafb;
        }
        input,
        button,
        select,
        textarea {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}

// ✨ Professional, visible, accessible styles
const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '1.5rem',
    backgroundColor: '#f9fafb',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    padding: '2.5rem',
    borderRadius: '12px',
    backgroundColor: 'white',
    boxShadow:
      '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    border: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '1.875rem',
    fontWeight: 700,
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: '0.5rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#6b7280',
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#374151',
  },
  input: {
    padding: '0.75rem',
    borderRadius: '8px',
    border: '1px solid #d1d5db',
    fontSize: '1rem',
    backgroundColor: 'white',
    color: '#111827',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '0.875rem',
    cursor: 'pointer',
    padding: 0,
    marginTop: '0.25rem',
  },
  button: {
    padding: '0.875rem',
    borderRadius: '8px',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'white',
    backgroundColor: '#3b82f6',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonLoading: {
    opacity: 0.8,
    cursor: 'not-allowed',
  },
  alertError: {
    padding: '0.75rem',
    backgroundColor: '#fee2e2',
    color: '#b91c1c',
    borderRadius: '8px',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  alertSuccess: {
    padding: '0.75rem',
    backgroundColor: '#dcfce7',
    color: '#166534',
    borderRadius: '8px',
    fontSize: '0.875rem',
    marginBottom: '1rem',
  },
  footer: {
    textAlign: 'center' as const,
    marginTop: '1.5rem',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  link: {
    color: '#3b82f6',
    textDecoration: 'none',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
