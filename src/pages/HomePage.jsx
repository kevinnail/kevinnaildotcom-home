import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import CardGrid from '../components/home/CardGrid';

export default function HomePage() {
  return (
    <>
      <Helmet>
        <title>Kevin Nail</title>
        <meta
          name="description"
          content="Kevin Nail's personal website connecting his glass business Stress Less Glass, his mushroom business Good Morning Mushrooms, his web development projects (React/ Express.js/ Node.js), and his music (drums and bass guitar)"
        />
        <link rel="canonical" href="https://kevinnail.com/" />
      </Helmet>

      <div
        className="flex flex-col min-h-screen bg-black/50"
        style={{
          backgroundImage: "url('/images/background-glass.jpg')",
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundAttachment: 'fixed',
          backgroundPosition: 'center',
        }}
      >
        <div className="flex flex-col min-h-screen bg-black/50">
          <Banner />
          <CardGrid />
        </div>
      </div>
    </>
  );
}
