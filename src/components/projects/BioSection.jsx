import ContactLinks from './ContactLinks';

export default function BioSection() {
  return (
    <section className="bg-mid-gray pb-6 lg:py-6">
      <div className="px-5">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <img
              src="/images/kevin.jpeg"
              alt="Kevin Nail portrait"
              className="border-2 border-black w-[180px] mx-auto lg:mx-0 lg:w-full lg:max-w-[320px] rounded-md"
              loading="lazy"
            />

            <div className="bg-black/40 border border-white/10 rounded-md p-4">
              <h3 className="m-0 mb-3 font-display tracking-[3px] text-lg">
                Connect
              </h3>
              <ContactLinks />
            </div>
          </aside>

          <div className="space-y-4">
            <h3 className="m-0 font-display tracking-[3px] text-xl md:text-2xl">
              About
            </h3>

            <p className="m-0">
              I&apos;m Kevin Nail — a full‑stack developer who likes building
              practical, reliable tools with clean UX. I got into coding back in
              the early 2000&apos;s while running my glass business: first by
              improving eBay listings, then by building Excel/VBA apps for
              accounting, inventory, and day-to-day workflow.
            </p>

            <p className="m-0">
              In 2022 I attended Alchemy Code Lab for web development and worked
              through a React / Node / Express stack with multiple group
              projects. When the program shut down unexpectedly, our cohort kept
              going independently — meeting up, shipping projects, and keeping
              each other accountable.
            </p>

            <p className="m-0">
              For the last ~2.5 years I&apos;ve been building a longer-running
              product and using it as a deep dive into engineering habits:
              error handling, testing, securing sensitive data, and defensive
              design. I&apos;ve implemented AWS Cognito, S3, and CloudFront,
              plus Redis caching and real-time WebSocket features.
            </p>

            <div className="bg-black/40 border border-white/10 rounded-md p-4">
              <h4 className="m-0 mb-2 font-display tracking-[3px] text-base">
                Focus areas
              </h4>
              <ul className="m-0 pl-5 space-y-1">
                <li>React front-ends with component-driven UI</li>
                <li>Node/Express APIs using Postgres and data-backed features</li>
                <li>AWS auth + media delivery (Cognito, S3, CloudFront)</li>
                <li>Performance + real-time UX (Redis, WebSockets)</li>
              </ul>
            </div>

            <p className="m-0">
              I&apos;m looking for my next opportunity in software development.
              If you&apos;d like to connect, collaborate, or just talk shop,
              reach out through the links here.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
