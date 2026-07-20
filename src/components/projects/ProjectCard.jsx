import { useState } from 'react';
import useInView from '../../hooks/useInView';
import DecodeText from './DecodeText';

// Follows the cursor and feeds its position to the card as CSS custom props,
// which drive the edge-light glow. Written straight to the DOM node (no state)
// so moving the mouse never triggers a React render.
function trackPointer(event) {
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty('--pointer-x', `${event.clientX - bounds.left}px`);
  card.style.setProperty('--pointer-y', `${event.clientY - bounds.top}px`);
}

export default function ProjectCard({ project, index = 0, featured = false }) {
  const {
    title,
    subtitle,
    category,
    stack,
    description,
    mediaType,
    mediaSrc,
    mediaSrcs,
    poster,
    links,
  } = project;

  const [isExpanded, setIsExpanded] = useState(false);
  const [cardRef, isInView] = useInView();

  const clampStyle = isExpanded
    ? undefined
    : {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: featured ? 7 : 5,
        overflow: 'hidden',
      };

  const media = (
    <div className="relative overflow-hidden bg-black h-full">
      {mediaType === 'video' ? (
        <div className="aspect-video w-full h-full">
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
        <div className="aspect-video w-full h-full bg-gradient-to-b from-zinc-900 via-neutral-900 to-black flex items-center justify-center gap-2 sm:gap-3 px-3 py-4 sm:px-6 sm:py-5 transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.03]">
          {mediaSrcs.map((src, screenshotIndex) => (
            <img
              key={src}
              src={src}
              alt={`${title} screenshot ${screenshotIndex + 1}`}
              loading="lazy"
              decoding="async"
              width="1170"
              height="2532"
              className="h-44 sm:h-52 md:h-60 lg:h-64 w-auto object-contain rounded-xl ring-1 ring-white/10 shadow-2xl shadow-black/60"
            />
          ))}
        </div>
      ) : (
        <div className="aspect-video w-full h-full">
          <img
            className="w-full h-full object-cover transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.05]"
            src={mediaSrc}
            alt={title}
            loading="lazy"
          />
        </div>
      )}
      {/* Media never sits flush against the panel wall on the featured split. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
        aria-hidden="true"
      />
    </div>
  );

  const body = (
    <div className="relative flex flex-col flex-1 p-5">
      <div className="relative z-10 flex-1">
        {category && (
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="h-3 w-[3px] bg-neon-blue shadow-[0_0_8px_rgba(47,0,255,0.9)]"
              aria-hidden="true"
            />
            <span className="text-[0.68rem] font-semibold uppercase tracking-[3px] text-white/45">
              {category}
            </span>
          </div>
        )}

        <h3
          className={
            'm-0 font-display font-bold tracking-[0.5px] leading-[1.1] ' +
            (featured ? 'text-2xl sm:text-3xl' : 'text-xl')
          }
        >
          <DecodeText text={subtitle || title} start={isInView} />
        </h3>

        <p
          className="mt-3 mb-0 text-[0.9rem] leading-[1.65] text-white/80 tracking-[0.2px]"
          style={clampStyle}
        >
          {description}
        </p>

        <button
          type="button"
          onClick={() => setIsExpanded((previous) => !previous)}
          className="mt-3 inline-flex items-center gap-1.5 bg-transparent border-0 p-0 text-white/60 font-semibold text-[0.72rem] uppercase tracking-[2px] transition-colors duration-200 hover:text-white rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? 'Less' : 'Read more'}</span>
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

      {stack?.length > 0 && (
        <ul className="relative z-10 mt-5 flex flex-wrap gap-2 p-0 m-0 list-none">
          {stack.map((technology) => (
            <li
              key={technology}
              className="text-[0.7rem] font-medium tracking-[0.5px] text-white/65 px-2.5 py-1 rounded-full border border-white/12 bg-white/[0.03]"
            >
              {technology}
            </li>
          ))}
        </ul>
      )}

      <nav className="relative z-10 mt-6 grid grid-cols-2 gap-2.5 [&>a:last-child:nth-child(odd)]:col-span-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-white/90 text-center font-semibold text-[0.8rem] tracking-[0.5px] leading-snug px-3 py-3 rounded-lg border border-white/15 bg-white/[0.02] transition-colors duration-200 hover:text-white hover:border-neon-blue hover:bg-neon-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );

  return (
    <section
      ref={cardRef}
      onMouseMove={trackPointer}
      style={{ animationDelay: `${Math.min(index, 3) * 80}ms` }}
      className={
        'spotlight group relative flex flex-col h-full overflow-hidden rounded-2xl bg-neutral-950 ' +
        'border border-white/[0.08] energize motion-safe:hover:-translate-y-1 ' +
        (featured
          ? 'lg:col-span-2 shadow-[0_0_60px_-20px_rgba(47,0,255,0.5)] '
          : '') +
        (isInView ? 'energized' : '')
      }
    >
      {featured ? (
        <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-stretch">
          <div className="border-b border-white/10 lg:border-b-0 lg:border-r">{media}</div>
          {body}
        </div>
      ) : (
        <>
          <div className="border-b border-white/10">{media}</div>
          {body}
        </>
      )}

      <div
        className="trace pointer-events-none absolute inset-0 z-20 rounded-2xl"
        aria-hidden="true"
      />
    </section>
  );
}
