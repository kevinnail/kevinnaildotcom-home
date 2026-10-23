import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import BlogPostBody from '../components/blog/BlogPostBody';
import NotFoundPage from './NotFoundPage';
import { fetchBlogPost, NotFoundError } from '../api/mediaApi';
import { useAdminToken } from '../hooks/adminSession';
import formatBlogDate from '../utils/formatBlogDate';
import './BlogPostPage.css';

const BlogPostPage = () => {
  const { slug } = useParams();
  const isAdmin = Boolean(useAdminToken());
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notFound | error

  useEffect(() => {
    let active = true;
    (async () => {
      setStatus('loading');
      try {
        const loadedPost = await fetchBlogPost(slug);
        if (!active) return;
        setPost(loadedPost);
        setStatus('ready');
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof NotFoundError) {
          setStatus('notFound');
          return;
        }
        console.error('Loading blog post failed', loadError);
        setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (status === 'notFound') return <NotFoundPage />;

  return (
    <>
      {post && (
        <Helmet>
          <title>{`Kevin Nail | ${post.title}`}</title>
          <meta name="description" content={post.summary} />
          <link rel="canonical" href={`https://kevinnail.com/blog/${post.slug}`} />
        </Helmet>
      )}
      <div className="blog-post-page">
        <Banner />
        <main className="blog-post-content">
          <div className="blog-post-nav">
            <Link to="/blog" className="blog-post-nav-link">
              ← Blog
            </Link>
            {isAdmin && post && (
              <Link to={`/dashboard/blog/${post.id}`} className="blog-post-nav-link">
                Edit post
              </Link>
            )}
          </div>

          {status === 'loading' && <p className="blog-post-message">Loading post…</p>}
          {status === 'error' && <p className="blog-post-error">Could not load the post.</p>}

          {status === 'ready' && (
            <article>
              <h1 className="blog-post-title">{post.title}</h1>
              <p className="blog-post-details">
                {formatBlogDate(post.publishedAt)} in{' '}
                <Link
                  to={`/blog?category=${encodeURIComponent(post.category)}`}
                  className="blog-post-category-link"
                >
                  {post.category}
                </Link>
              </p>
              <BlogPostBody blocks={post.blocks} />
            </article>
          )}
        </main>
      </div>
    </>
  );
};

export default BlogPostPage;
