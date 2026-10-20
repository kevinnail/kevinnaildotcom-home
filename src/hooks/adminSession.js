import { useSyncExternalStore } from 'react';

// The admin token lives in sessionStorage, as it always has. It's shared here
// because more than one page reads it: the dashboard gates its whole UI on it,
// and the hike map shows an admin-only link back to the dashboard. Owning the
// key in one place lets every reader update the moment sign-in or sign-out
// happens instead of each page keeping its own copy.
const TOKEN_KEY = 'mediaAdminToken';

const listeners = new Set();

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(onChange) {
  listeners.add(onChange);
  // `storage` only fires in *other* tabs, so signing out in one tab logs the
  // rest out too; same-tab changes come through notify().
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

const getSnapshot = () => sessionStorage.getItem(TOKEN_KEY);

// No sessionStorage during a server render — treat it as signed out.
const getServerSnapshot = () => null;

export function signIn(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
  notify();
}

export function signOut() {
  sessionStorage.removeItem(TOKEN_KEY);
  notify();
}

export function useAdminToken() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
