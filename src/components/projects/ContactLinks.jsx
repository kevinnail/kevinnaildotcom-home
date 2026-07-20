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
            className="no-underline inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.02] px-3 py-2 text-sm font-display tracking-[2px] text-white/90 transition-colors duration-200 hover:text-white hover:border-neon-blue hover:bg-neon-blue focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-blue"
          >
            {link.label}
          </a>
        );
      })}
    </div>
  );
}
