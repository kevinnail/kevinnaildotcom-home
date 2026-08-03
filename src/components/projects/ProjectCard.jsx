import { useState } from 'react';
import useInView from '../../hooks/useInView';
import trackPointer from '../../lib/trackPointer';
import DecodeText from './DecodeText';

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

  const header = (
    <div className="relative z-10 px-5 pt-5">
      {category && (
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[3px] text-neon-blue-bright/80">
          {category}
        </span>
      )}

      <h3
        className={
          'mt-2 mb-0 font-display font-bold tracking-[0.5px] leading-[1.1] ' +
          (featured ? 'text-2xl sm:text-3xl' : 'text-xl')
        }
      >
        <DecodeText text={subtitle || title} start={isInView} />
      </h3>
    </div>
  );

  const media = (
    <div className="relative z-10 px-5 py-4">
      <div className="relative overflow-hidden rounded-xl bg-black ring-1 ring-white/15 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.95)]">
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
          <div className="aspect-video w-full bg-gradient-to-b from-zinc-900 via-neutral-900 to-black flex items-center justify-center gap-2 sm:gap-3 px-3 py-4 sm:px-6 sm:py-5 transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.03]">
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
          <div className="aspect-video w-full">
            <img
              className="w-full h-full object-cover transition-transform duration-[600ms] ease-out motion-safe:group-hover:scale-[1.05]"
              src={mediaSrc}
              alt={title}
              loading="lazy"
            />
          </div>
        )}
      </div>
    </div>
  );

  const body = (
    <div className="relative z-10 flex flex-col flex-1 px-5 pb-5">
      <div className="flex-1">
        <p
          className="mt-0 mb-0 text-[0.9rem] leading-[1.65] text-white/80 tracking-[0.2px]"
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
        <ul className="mt-5 flex flex-wrap gap-2 p-0 m-0 list-none">
          {stack.map((technology) => (
            <li
              key={technology}
              className="text-[0.7rem] font-medium tracking-[0.5px] text-white/70 px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.06]"
            >
              {technology}
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-6 grid grid-cols-2 gap-2.5 [&>a:last-child:nth-child(odd)]:col-span-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline text-white/90 text-center font-semibold text-[0.8rem] tracking-[0.5px] leading-snug px-3 py-3 rounded-lg border border-white/20 bg-white/[0.05] transition-colors duration-200 hover:text-white hover:border-neon-blue hover:bg-neon-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue"
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
        'spotlight group relative flex flex-col h-full overflow-hidden rounded-2xl ' +
        'bg-[#101015] border transition-colors duration-300 ' +
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_24px_50px_-28px_rgba(0,0,0,0.95)] ' +
        'energize ' +
        (featured ? 'lg:col-span-2 border-white/20 ' : 'border-white/15 hover:border-white/25 ') +
        (isInView ? 'energized' : '')
      }
    >
      {featured ? (
        <>
          {header}
          <div className="lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-start">
            {media}
            <div className="flex flex-col lg:pt-4">{body}</div>
          </div>
        </>
      ) : (
        <>
          {header}
          {media}
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
