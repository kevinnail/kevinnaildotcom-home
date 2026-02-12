export default function DiagramsSection() {
  return (
    <section className="flex flex-col items-center">
      <p className="m-0 p-5 bg-mid-gray w-full">
        These are a couple of current projects in the works I made diagrams for-
        the first is a group project, and by far my most complicated data flow
        concept. It&apos;s the back end database architecture incorporating AWS Cognito/ AWS S3/ Stripe API webhooks/
       all together. The 2nd is a garden tracker app I
        built in VBA which will also be an upcoming app- so I can&apos;t show
        you too much ;)
      </p>
      <img
        src="/images/database-2.png"
        alt="Database diagram"
        className="block m-2 max-w-[95%] lg:max-w-full rounded-2xl shadow-[0_0_10px_0px_black]"
        loading="lazy"
      />
      <img
        src="/images/app-flow-1.png"
        alt="App flow diagram"
        className="block m-2 max-w-[95%] lg:max-w-full rounded-2xl shadow-[0_0_10px_0px_black]"
        loading="lazy"
      />
    </section>
  );
}
