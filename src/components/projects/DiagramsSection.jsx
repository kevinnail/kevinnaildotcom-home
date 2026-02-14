export default function DiagramsSection() {
  return (
    <section className="flex flex-col items-center">
      <p className="m-0 p-5 bg-mid-gray w-full">
       I love making diagrams for complex systems- there are for a few of my current projects.  All are Express/ Node servers using Postgres databases, but the 
       diagrams depict complex data relationships and flows.  
      </p>
 
      <p className="m-0 p-5 bg-mid-gray w-full" style={{paddingTop:'0'}}>
      The first is showing my most complex system I've built that uses AWS Cognito, AWS S3, Cloudfront, Redis, Websockets, and Stripe API webhooks
       all together- this is a full social media platform designed for many users. 
      </p>
       
       <p className="m-0 p-5 bg-mid-gray w-full" style={{paddingTop:'0'}}>
       The 2nd is a diagram for my business site that's live with users- it has homegrown auth using AWS S3 for image 
       uploads, websockets for instant messaging and live auctions, and a 3rd party mailer for email notifications to users.  
      </p>
              
     <p className="m-0 p-5 bg-mid-gray w-full" style={{paddingTop:'0'}}>
      The final image is more a diagram of the front end program flow for screens/ forms. Originally built in VBA in MS Excel, it's where I started teaching myself programming.
      </p>
      <img
        src="/images/database-atf"
        alt="Database diagram"
        className="block m-2 max-w-[95%] lg:max-w-full rounded-2xl shadow-[0_0_10px_0px_black]"
        loading="lazy"
      />
      <img
        src="/images/database-slg"
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
