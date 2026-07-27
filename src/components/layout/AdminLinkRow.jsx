import { Link } from 'react-router-dom';
import { useAdminToken } from '../../lib/adminSession';

// Admin-only shortcut row. Sits directly under the banner so it can't be clipped
// by a page's scroll containers or covered by the map's own controls, and renders
// nothing at all for visitors — there is exactly one admin.
export default function AdminLinkRow({ to, label }) {
  const isAdmin = Boolean(useAdminToken());
  if (!isAdmin) return null;

  return (
    <div className="shrink-0 border-b border-neon-blue-50 bg-black px-4 py-1.5 text-left">
      <Link
        to={to}
        className="font-body text-sm text-neon-blue-bright underline transition-colors hover:text-white"
      >
        {label}
      </Link>
    </div>
  );
}
