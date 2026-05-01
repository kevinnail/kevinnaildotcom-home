import { useState } from 'react';

export default function ProjectCard({ project }) {
  const { title, subtitle, description, mediaType, mediaSrc, mediaSrcs, poster, links } =
    project;

  const [isExpanded, setIsExpanded] = useState(false);

  const clampStyle = isExpanded
    ? undefined
    : {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 5,
        overflow: 'hidden',
      };

  return (
    <section className="relative flex flex-col h-full overflow-hidden rounded-2xl bg-neutral-950 border border-white/[0.08] transition-colors duration-300 hover:border-white/20">
      <div className="bg-black border-b border-white/10">
        {mediaType === 'video' ? (
          <div className="aspect-video w-full">
            <video
              className="w-full h-full object-contain bg-black"
              controls
              poster={poster}
              preload="none"
            >
              <source src={mediaSrc} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        ) : mediaType === 'screenshots' ? (
          <div className="aspect-video w-full bg-gradient-to-b from-zinc-900 via-neutral-900 to-black flex items-center justify-center gap-2 sm:gap-3 px-3 py-4 sm:px-6 sm:py-5">
            {mediaSrcs.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`${title} screenshot ${i + 1}`}
                loading="lazy"
                decoding="async"
                width="1170"
                height="2532"
                className="h-44 sm:h-52 md:h-60 lg:h-64 w-auto object-contain rounded-xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
              />
            ))}
          </div>
        ) : (
          <div className="aspect-video w-full">
            <img
              className="w-full h-full object-cover"
              src={mediaSrc}
              alt={title}
              loading="lazy"
            />
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-5 sm:p-6">
        <div className="flex-1">
          <div className="mb-3 h-[2px] w-8 bg-neon-blue" aria-hidden="true" />

          <h3 className="m-0 font-display font-bold text-lg sm:text-xl tracking-[0.5px] leading-tight">
            {subtitle || title}
          </h3>

          <p
            className="mt-3 mb-0 text-[0.9rem] leading-[1.65] text-white/85 tracking-[0.3px]"
            style={clampStyle}
          >
            {description}
          </p>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="mt-3 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-neon-blue font-semibold text-[0.72rem] uppercase tracking-[2px] transition-colors duration-200 hover:text-white rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Less' : 'More'}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={'transition-transform duration-300 ' + (isExpanded ? 'rotate-180' : '')}
              aria-hidden="true"
            >
              <path
                d="M2 3.5L5 6.5L8 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <nav className="mt-6 grid grid-cols-2 gap-2.5 [&>a:last-child:nth-child(odd)]:col-span-2">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-white text-center font-semibold text-[0.8rem] tracking-[0.5px] leading-snug px-3 py-3 rounded-lg border border-white/15 bg-white/[0.02] transition-colors duration-200 hover:border-neon-blue hover:bg-neon-blue/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
