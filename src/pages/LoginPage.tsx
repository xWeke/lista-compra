// Login con email y contraseña. No hay registro: las cuentas se crean en Supabase.
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/Button';
import { useAuth } from '@/lib/auth';

import styles from './LoginPage.module.css';

export function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      // Al haber sesión, el router redirige solo a la portada.
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg === 'Invalid login credentials' ? 'Email o contraseña incorrectos.' : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.container}>
      <form className={styles.form} onSubmit={submit}>
        <h1 className={styles.title}>
          <span aria-hidden>🛒 </span>
          Lista de la compra
        </h1>
        <label htmlFor="email" className="visually-hidden">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          autoCapitalize="none"
          required
        />
        <label htmlFor="password" className="visually-hidden">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          required
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {/* Siempre activo: si falta algo, `required` hace que el navegador lo señale al enviar */}
        <Button type="submit" loading={submitting}>
          Entrar
        </Button>
      </form>
    </main>
  );
}
