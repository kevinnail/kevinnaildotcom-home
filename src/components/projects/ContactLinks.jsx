import contactLinks from '../../data/contactLinks';

export default function ContactLinks() {
  return (
    <div className="grid grid-cols-2 md:flex md:justify-center gap-2 max-w-full py-2">
      {contactLinks.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith('mailto:') ? undefined : '_blank'}
          rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
          className="no-underline text-white font-bold inline-block px-2.5 py-1.5 text-[0.8rem] rounded-md text-center w-[100px] mx-auto transition-colors duration-500 hover:bg-white hover:text-black"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
