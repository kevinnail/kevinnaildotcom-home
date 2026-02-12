import ContactLinks from './ContactLinks';

export default function BioSection() {
  return (
    <section className="bg-mid-gray pb-5 lg:pt-2.5">
      <div className="px-5">
        <img
          src="/images/kevin.jpeg"
          alt="Kevin Nail portrait"
          className="float-left mr-4 border-2 border-black w-[150px] lg:w-[350px] lg:mx-4"
          loading="lazy"
        />
        <p>
          Hello, welcome! I originally started coding because I needed to make
          my auctions on eBay look better so I could sell my glass back in the
          early 2000&apos;s. Along the way I started building applications in
          Excel with VBA exploring the possibilities. I&apos;ve since built
          business tools for my glass business to track various accounting and
          inventory aspects, and color coded display calendar so I can see at a
          glance where my business is at and what needs to be done.
        </p>
        <p>
          Eventually I went to school at Alchemy Code Lab for web development
          officially in the fall of 2022 and learned a full stack of React/
          Node/ Express with multiple group projects and enjoyed the
          collaborative efforts and friends I made. School closed on us without
          warning 3/4 of the way through, so we continued on our training on our
          own meeting up and creating new projects.
        </p>
        <p>
          I started and have been working on a project for almost 2 yrs now
          learning and incorporating all kinds of technologies and techniques,
          from error handling to testing, encryption of sensitive data to
          security policies. I&apos;m familiarizing myself with AWS- Cognito, S3
          buckets, CloudFront are so far implemented, as well as caching with
          Redis and instant messaging with WebSockets.
        </p>
        <p>
          I&apos;m looking for a new opportunity to head in this direction
          professionally, so if you&apos;re in the world of coding, please feel
          free to get in touch and connect. I&apos;m here coding and building
          and learning as much as possible in the meantime. If you have any
          questions or want to connect please feel free to check my repos out or
          get in touch through any of the links below.
        </p>

        <ContactLinks />

        <p>
          Using my creativity and passion to create excellent tools that work
          well and enhance the human experience is my jam.
        </p>
      </div>
    </section>
  );
}
