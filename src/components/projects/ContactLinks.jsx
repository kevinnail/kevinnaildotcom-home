import contactLinks from '../../data/contactLinks';

export default function ContactLinks() {
  return (
    <div className="grid grid-cols-2 gap-2">
      {contactLinks.map((link) => {
        const isEmail = link.href.startsWith('mailto:');

        return (
          <a
            key={link.label}
            href={link.href}
            target={isEmail ? undefined : '_blank'}
            rel={isEmail ? undefined : 'noopener noreferrer'}
            aria-label={link.ariaLabel ?? link.label}
            title={link.label}
            className="no-underline inline-flex items-center justify-center rounded-md border border-white/20 bg-black px-3 py-2 text-sm font-display tracking-[2px] text-white transition-colors duration-300 hover:bg-white hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {link.label}
          </a>
        );
      })}
    </div>
  );
}
