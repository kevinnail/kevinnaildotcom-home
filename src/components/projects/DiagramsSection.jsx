import SectionTitle from './SectionTitle';

const diagrams = [
  {
    src: '/images/database-atf.png',
    alt: 'At The Fire database diagram',
    caption:
      'My most complex system: a full social platform designed for many users, wiring together AWS Cognito, AWS S3, CloudFront, Redis, WebSockets, and Stripe API webhooks.',
  },
  {
    src: '/images/database-slg.png',
    alt: 'Stress Less Glass database diagram',
    caption:
      'My business site, live with users: homegrown auth, AWS S3 for image uploads, WebSockets for instant messaging / live auctions / notifications, and a third-party mailer for email.',
  },
  {
    src: '/images/app-flow-1.png',
    alt: 'App flow diagram',
    caption:
      'Front-end program flow for screens and forms. Originally built in VBA inside MS Excel, where I started teaching myself to program.',
  },
];

export default function DiagramsSection() {
  return (
    <section className="px-5 py-6 sm:px-6">
      <SectionTitle>System Diagrams</SectionTitle>

      <p className="mt-4 mb-0 max-w-[70ch] text-[0.92rem] leading-[1.65] text-white/70">
        Mapping out complex systems is part of my process, great for OCD&apos;ing down to each
        piece of data, and a powerful planning and communication tool for the team. These are from a
        few of my current projects. All are Express/Node servers on Postgres; the diagrams depict
        the data relationships and flows described below.
      </p>

      <div className="mt-6 space-y-8">
        {diagrams.map((diagram) => (
          <figure key={diagram.src} className="m-0">
            <figcaption className="mb-3 max-w-[70ch] text-[0.9rem] leading-[1.6] text-white/70">
              {diagram.caption}
            </figcaption>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-neutral-950 p-2 sm:p-3">
              <img
                src={diagram.src}
                alt={diagram.alt}
                className="block w-full rounded-xl"
                loading="lazy"
              />
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
