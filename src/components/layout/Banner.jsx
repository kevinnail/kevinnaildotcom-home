import { Link } from 'react-router-dom';

export default function Banner() {
  return (
    <header className="relative w-full overflow-hidden border-b border-white/10 bg-neutral-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(650px_circle_at_10%_130%,rgba(47,0,255,0.4),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-neon-blue to-transparent"
      />

      <div className="relative z-[1] flex w-full items-end gap-3 px-5 py-2.5 sm:gap-4 sm:px-6">
        <Link
          to="/"
          className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
        >
          {' '}
          <img
            className="block h-7 w-auto brightness-0 invert sm:h-9"
            src="/images/knBanner.png"
            alt="Kevin Nail"
            title="Kevin Nail"
          />
        </Link>

        <span className="font-display text-[0.8rem] leading-none tracking-[1px] text-white/45 sm:text-base">
          Artistry in Every Medium
        </span>
      </div>
    </header>
  );
}
