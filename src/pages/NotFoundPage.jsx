import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Kevin Nail | Page Not Found</title>
      </Helmet>

      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white text-center px-4">
        <h1 className="text-6xl font-display mb-4">404</h1>
        <p className="text-xl mb-8">
          Oops! The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          to="/"
          className="text-neon-blue hover:text-white border-2 border-neon-blue-50 px-6 py-3 rounded-lg transition-colors duration-300 no-underline font-bold"
        >
          Go Home
        </Link>
      </div>
    </>
  );
}
