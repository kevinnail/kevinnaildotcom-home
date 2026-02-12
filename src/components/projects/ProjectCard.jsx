export default function ProjectCard({ project }) {
  const { title, subtitle, description, mediaType, mediaSrc, poster, links } =
    project;

  return (
    <section className="border-[3px] border-[rgb(165,165,165)] rounded-2xl mx-2 my-6 overflow-hidden bg-black lg:grid lg:grid-cols-[300px_1fr] lg:h-[350px] lg:backdrop-blur-[15px] lg:min-w-[968px] transition-all duration-350">
      <div className="flex max-h-full">
        {mediaType === 'video' ? (
          <video
            className="max-h-full max-w-full w-full"
            controls
            poster={poster}
            preload="none"
            style={{ boxShadow: 'rgba(255,255,255,0.196) 1px 1px 15px 5px' }}
          >
            <source src={mediaSrc} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <img
            className="max-h-full max-w-full w-full object-cover"
            src={mediaSrc}
            alt={title}
            loading="lazy"
          />
        )}
      </div>

      <div className="bg-black pt-0">
        <nav className="flex flex-wrap justify-around items-center py-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline text-white font-bold inline-block px-2.5 py-1.5 text-[0.7rem] rounded-md border-2 border-transparent text-center transition-all duration-500 hover:border-neon-blue-50 hover:animate-[ocean_4s_ease-in-out_infinite]"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <p className="px-4 text-[0.8rem] bg-black opacity-80 m-0 leading-6 tracking-[1px] min-w-[250px]">
          <span className="text-[1.2rem] font-bold block font-[Gruppo,verdana]">
            <em>{subtitle || title}</em>
          </span>{' '}
          {description}
        </p>
      </div>
    </section>
  );
}
