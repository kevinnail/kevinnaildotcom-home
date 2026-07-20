import ContactLinks from './ContactLinks';
import SectionEyebrow from './SectionEyebrow';

export default function BioSection() {
  return (
    <section className="px-5 py-6 sm:px-6">
      <SectionEyebrow label="About" />

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <img
            src="/images/kevin.jpeg"
            alt="Kevin Nail portrait"
            className="w-[180px] mx-auto lg:mx-0 lg:w-full lg:max-w-[300px] rounded-2xl border border-white/[0.08]"
            loading="lazy"
          />

          <div className="rounded-2xl bg-neutral-950 border border-white/[0.08] p-5">
            <h3 className="m-0 mb-3 font-display font-bold tracking-[2px] text-lg">Connect</h3>
            <ContactLinks />
          </div>
        </aside>

        <div className="space-y-4">
          <h2 className="m-0 font-display font-bold tracking-[0.5px] text-2xl sm:text-3xl leading-[1.1]">
            Full-stack developer building practical, reliable tools.
          </h2>

          <p className="m-0 text-[0.95rem] leading-[1.7] text-white/80">
            I&apos;m Kevin Nail — a full-stack developer who likes building practical, reliable
            tools with clean UX. I got into coding back in the early 2000&apos;s while running my
            glass business: first by improving eBay listings, then by building Excel/VBA apps for
            accounting, inventory, and day-to-day workflow.
          </p>

          <p className="m-0 text-[0.95rem] leading-[1.7] text-white/80">
            In 2022 I attended Alchemy Code Lab for web development and worked through a React /
            Node / Express / Postgres stack with multiple group projects. When the program shut
            down unexpectedly, our cohort kept going independently — meeting up, shipping projects,
            and keeping each other accountable.
          </p>

          <p className="m-0 text-[0.95rem] leading-[1.7] text-white/80">
            For the last ~2.5 years I&apos;ve been building a longer-running product (At The Fire,
            see my projects) and using it as a deep dive into engineering habits: error handling,
            testing, securing sensitive data, and defensive design. I&apos;ve implemented AWS
            Cognito, S3, and CloudFront, plus Redis caching and real-time WebSocket features.
          </p>

          <div className="rounded-2xl bg-neutral-950 border border-white/[0.08] p-5">
            <h3 className="m-0 mb-3 font-display font-bold tracking-[2px] text-base">Focus areas</h3>
            <ul className="m-0 pl-5 space-y-1.5 list-disc marker:text-neon-blue text-[0.9rem] leading-[1.6] text-white/80">
              <li>React front-ends with component-driven UI</li>
              <li>Node/Express APIs using Postgres and data-backed features</li>
              <li>AWS auth + media delivery (Cognito, S3, CloudFront)</li>
              <li>Performance + real-time UX (Redis, WebSockets)</li>
            </ul>
          </div>

          <p className="m-0 text-[0.95rem] leading-[1.7] text-white/80">
            I&apos;m looking for my next opportunity in software development. If you&apos;d like to
            connect, collaborate, or just talk shop, reach out through the links here.
          </p>
        </div>
      </div>
    </section>
  );
}
