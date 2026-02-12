import { useState } from 'react';

export default function ProjectCard({ project }) {
  const { title, subtitle, description, mediaType, mediaSrc, poster, links } =
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
    <section className="border-2 border-white/15 rounded-2xl overflow-hidden bg-mid-gray flex flex-col h-full">
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

      <div className="bg-black flex flex-col flex-1">
        <div className="p-4 pb-3 flex-1">
          <h3 className="m-0 text-[1.05rem] font-bold font-display tracking-[1px]">
            {subtitle || title}
          </h3>

          <p
            className="mt-2 mb-0 text-[0.9rem] opacity-90 leading-6 tracking-[0.5px]"
            style={clampStyle}
          >
            {description}
          </p>

          <div className="mt-3">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              className="bg-transparent border-0 p-0 text-neon-blue font-bold text-[0.85rem] underline underline-offset-4 transition-colors duration-300 hover:text-white"
              aria-expanded={isExpanded}
            >
              {isExpanded ? 'Less' : 'More'}
            </button>
          </div>
        </div>

        <nav className="flex flex-wrap justify-around items-center gap-1 p-2 border-t border-white/10 mt-auto">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-white font-bold inline-block px-2.5 py-1.5 text-[0.8rem] rounded-md border border-transparent text-center transition-colors duration-300 hover:border-neon-blue-50"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}
