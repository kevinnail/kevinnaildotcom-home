import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import GalleryGrid from '../components/astrophotography/GalleryGrid';

export default function AstrophotographyPage() {
  return (
    <>
      <Helmet>
        <title>Kevin Nail | Astrophotography</title>
        <meta
          name="description"
          content="Kevin Nail's astrophotography gallery featuring solar eclipses, planets, nebulae, and more."
        />
        <link rel="canonical" href="https://kevinnail.com/astrophotography" />
      </Helmet>

      <div className="bg-black min-h-screen">
        <Banner />
        <GalleryGrid />
      </div>
    </>
  );
}
