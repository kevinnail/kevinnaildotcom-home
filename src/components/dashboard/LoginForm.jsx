import { useState } from 'react';
import { login } from '../../lib/mediaApi';

export default function LoginForm({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const token = await login(password);
      onAuthenticated(token);
    } catch {
      setError('Incorrect password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-16 flex flex-col gap-4 bg-neutral-900 p-6 rounded-lg border border-neon-blue-50"
    >
      <h2 className="text-neon-blue font-display text-2xl text-center">Admin Login</h2>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoFocus
        className="px-3 py-2 rounded bg-black text-white border border-mid-gray focus:border-neon-blue outline-none"
      />
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="px-4 py-2 rounded bg-neon-blue-50 text-white font-bold disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
