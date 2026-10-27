import { useState } from 'react';
import { login, InvalidPasswordError, NetworkError } from '../../api/mediaApi';

export default function LoginForm({ onAuthenticated }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');

    let token;
    try {
      token = await login(username, password);
    } catch (loginError) {
      // Only a 401 means the credentials were wrong. Anything else is a fault on
      // our side, and saying "incorrect password" would send the user chasing a
      // password that was never the problem — so name what actually broke and
      // keep the original error in the console to debug from.
      if (loginError instanceof InvalidPasswordError) {
        setError('Incorrect username or password.');
      } else if (loginError instanceof NetworkError) {
        // The browser withholds the CORS reason from JS, so the URL we called is
        // the only clue we can show — usually enough to spot a wrong API origin.
        setError(
          `Could not reach ${loginError.url}. If that address looks wrong, check VITE_API_URL; otherwise the browser console has the blocked-request details.`,
        );
        console.error(loginError.cause ?? loginError);
      } else {
        setError('Login failed: the server returned an error. See the console for details.');
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
      className="admin-panel"
      style={{ maxWidth: '24rem', margin: '4rem auto 0' }}
    >
      <h2 className="admin-section-title">Admin Login</h2>
      <input
        type="text"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Username"
        autoComplete="username"
        autoFocus
        className="admin-input"
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        className="admin-input"
      />
      {error && <p className="admin-error">{error}</p>}
      <button
        type="submit"
        disabled={busy || !username || !password}
        className="admin-button admin-button-primary"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
