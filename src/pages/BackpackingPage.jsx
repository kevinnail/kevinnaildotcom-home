import { Helmet } from 'react-helmet-async';
import Banner from '../components/layout/Banner';
import GalleryGrid from '../components/astrophotography/GalleryGrid';
import { fetchHikePhotos } from '../lib/mediaApi';

export default function BackpackingPage() {
  return (
    <>
      <Helmet>
        <title>Kevin Nail | Backpacking</title>
        <meta
          name="description"
          content="Kevin Nail's backpacking gallery — trail and summit photos from the trips."
        />
        <link rel="canonical" href="https://kevinnail.com/backpacking/gallery" />
      </Helmet>

      <div className="bg-black min-h-screen">
        <Banner />
        <GalleryGrid fetchPhotos={fetchHikePhotos} />
      </div>
    </>
  );
}
