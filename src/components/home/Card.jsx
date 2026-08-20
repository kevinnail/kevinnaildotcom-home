import { Link } from 'react-router-dom';
import useInView from '../../hooks/useInView';
import trackPointer from '../../lib/trackPointer';
import InspectorOverlay from './InspectorOverlay';
import { spanClasses } from './tileSizes';

export default function Card({ card, index = 0 }) {
  const {
    title,
    label,
    blurb,
    image,
    href,
    external,
    hoverBg,
    hoverFit,
    hoverPosition,
    size,
    inspector,
  } = card;
  const [cardRef, isInView] = useInView();

  const isHero = size === 'hero';

  const panel = (
    <article
      ref={cardRef}
      onMouseMove={trackPointer}
      style={{ animationDelay: `${Math.min(index, 5) * 80}ms` }}
      className={
        'spotlight group energize relative h-full w-full overflow-hidden rounded-2xl ' +
        'border border-white/[0.08] bg-neutral-950 transition-colors duration-300 ' +
        'hover:border-white/25 ' +
        (isInView ? 'energized' : '')
      }
    >
      <img
        src={image}
        alt=""
        loading="lazy"
        decoding="async"
        aria-hidden="true"
        className={
          'absolute inset-0 h-full w-full object-cover transition-[transform,opacity] ' +
          'duration-[600ms] ease-out motion-safe:group-hover:scale-[1.05] ' +
          (hoverBg ? 'group-hover:opacity-0' : '')
        }
      />

      {hoverBg && (
        <img
          src={hoverBg}
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden="true"
          style={hoverPosition ? { objectPosition: hoverPosition } : undefined}
          className={
            'absolute inset-0 h-full w-full opacity-0 transition-opacity duration-[600ms] ' +
            'ease-out group-hover:opacity-100 ' +
            (hoverFit === 'contain' ? 'object-contain p-6' : 'object-cover')
          }
        />
      )}

      <div
        className={
          'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t ' +
          (isHero
            ? 'from-black via-black/55 to-black/10 lg:bg-gradient-to-r lg:from-black lg:via-black/60 lg:to-transparent'
            : 'from-black via-black/45 to-transparent')
        }
        aria-hidden="true"
      />

      <div
        className={
          'relative z-[2] flex h-full flex-col justify-end gap-1 p-4 ' +
          (isHero ? 'md:p-6 lg:w-3/4 lg:justify-center' : '')
        }
      >
        {label && (
          <span className="font-body text-[0.72rem] font-semibold tracking-[0.3px] text-neon-blue-bright">
            {label}
          </span>
        )}
        <h2
          className={
            'm-0 font-display font-bold leading-[1.1] tracking-[0.5px] ' +
            (isHero ? 'text-2xl md:text-4xl lg:text-5xl' : 'text-base md:text-lg')
          }
        >
          {title}
        </h2>
        {blurb && (
          <p className="m-0 mt-1 font-body text-[0.78rem] md:text-[0.95rem] leading-snug text-white/70">
            {blurb}
          </p>
        )}
      </div>

      {inspector && <InspectorOverlay />}

      <div
        className="trace pointer-events-none absolute inset-0 z-[3] rounded-2xl"
        aria-hidden="true"
      />
    </article>
  );

  const wrapperClass =
    'group no-underline text-white rounded-2xl ' +
    'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-neon-blue ' +
    (spanClasses[size] ?? spanClasses.default);

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={wrapperClass}>
        {panel}
      </a>
    );
  }

  return (
    <Link to={href} className={wrapperClass}>
      {panel}
    </Link>
  );
}
