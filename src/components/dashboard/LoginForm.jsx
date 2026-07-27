import { useState } from 'react';
import { login, InvalidPasswordError, NetworkError } from '../../lib/mediaApi';

export default function LoginForm({ onAuthenticated }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    let token;
    try {
      token = await login(password);
    } catch (loginError) {
      // Only a 401 means the password was wrong. Anything else is a fault on our
      // side, and saying "incorrect password" would send the user chasing a
      // password that was never the problem — so name what actually broke and
      // keep the original error in the console to debug from.
      if (loginError instanceof InvalidPasswordError) {
        setError('Incorrect password.');
      } else if (loginError instanceof NetworkError) {
        // The browser withholds the CORS reason from JS, so the URL we called is
        // the only clue we can show — usually enough to spot a wrong API origin.
        setError(
          `Could not reach ${loginError.url}. If that address looks wrong, check VITE_API_URL; otherwise the browser console has the blocked-request details.`,
        );
        console.error(loginError.cause ?? loginError);
      } else {
        setError('Login failed — the server returned an error. See the console for details.');
        console.error(loginError);
      }
      return;
    } finally {
      setBusy(false);
    }

    // Deliberately outside the try: a failure to store the token is not a login
    // failure, and must not be reported as one.
    onAuthenticated(token);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-sm mx-auto mt-16 flex flex-col gap-4 bg-neutral-900 p-6 rounded-lg border border-neon-blue-50"
    >
      <h2 className="text-neon-blue-bright font-display text-2xl text-center">Admin Login</h2>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoFocus
        className="px-3 py-2 rounded bg-black text-white border border-mid-gray focus:border-neon-blue-bright outline-none"
      />
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        type="submit"
        disabled={busy || !password}
        className="px-4 py-2 rounded bg-neon-blue text-white font-bold cursor-pointer hover:bg-neon-blue-bright hover:text-black disabled:bg-neutral-700 disabled:text-neutral-300 disabled:cursor-not-allowed"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
