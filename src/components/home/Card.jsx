import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Card({ card }) {
  const [hovered, setHovered] = useState(false);
  const { title, image, href, external, hoverBg, hoverBgSize } = card;

  const cardContent = (
    <div
      className="bg-black pb-2.5 h-[175px] md:h-[225px] lg:h-[250px] rounded-lg grid min-w-[100px] border-2 border-neon-blue-50 overflow-hidden transition-all duration-500"
      style={{
        boxShadow: hovered
          ? '0 0 15px 0 white'
          : '0 0 5px pink',
        ...(hovered
          ? {
              height: '300px',
              backgroundImage: `linear-gradient(to bottom, #ffffff83, #2f00ff83), url(${hoverBg})`,
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              backgroundSize: `cover, ${hoverBgSize}`,
              transform: 'scale(1.1)',
            }
          : {}),
      }}
      onMouseEnter={() => {
        if (window.innerWidth >= 1024) setHovered(true);
      }}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={image}
        alt={title}
        className="w-full rounded-t-lg transition-all duration-500"
        loading="lazy"
        style={
          hovered
            ? {
                transition: '3s',
                width: '120%',
                transform: 'translateX(-10%)',
                opacity: 0,
              }
            : {}
        }
      />
      <p
        className="font-[Segoe_UI,Tahoma,Geneva,Verdana,sans-serif] text-[0.8rem] md:text-[1.2rem] m-0 transition-all duration-500 pl-2.5 self-end lg:w-[90%] lg:mx-auto"
        style={
          hovered
            ? {
                fontSize: '1.5rem',
                transition: '550ms',
                backgroundColor: 'black',
                borderRadius: '5px',
                boxShadow: 'inset 0 0 15px 0 #2f00ff83',
                opacity: 0,
              }
            : {}
        }
      >
        {title}
      </p>
    </div>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="no-underline text-white max-w-[190px] md:w-[205px] md:max-w-[205px] lg:w-[250px] lg:min-w-[250px]"
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link
      to={href}
      className="no-underline text-white max-w-[190px] md:w-[205px] md:max-w-[205px] lg:w-[250px] lg:min-w-[250px]"
    >
      {cardContent}
    </Link>
  );
}
