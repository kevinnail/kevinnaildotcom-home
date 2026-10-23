import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useSearchParams } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import AdminLinkRow from '../components/layout/AdminLinkRow';
import { fetchBlogPosts } from '../api/mediaApi';
import formatBlogDate from '../utils/formatBlogDate';
import './BlogPage.css';

const BlogPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loadedPosts = await fetchBlogPosts();
        if (!active) return;
        setPosts(loadedPosts);
        setStatus('ready');
      } catch (loadError) {
        if (!active) return;
        console.error('Loading blog posts failed', loadError);
        setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const categories = [...new Set(posts.map((post) => post.category))].sort();
  // Matched without case so a hand-typed link like ?category=coding still filters.
  const requestedCategory = searchParams.get('category') ?? '';
  const selectedCategory =
    categories.find((category) => category.toLowerCase() === requestedCategory.toLowerCase()) ??
    requestedCategory;
  const visiblePosts = selectedCategory
    ? posts.filter((post) => post.category === selectedCategory)
    : posts;

  const handleCategoryChange = (event) =>
    setSearchParams(event.target.value ? { category: event.target.value } : {});

  return (
    <>
      <Helmet>
        <title>Kevin Nail | Blog</title>
        <meta
          name="description"
          content="Kevin Nail's blog: backpacking trips, astronomy, coding projects, music, and mushroom foraging."
        />
        <link rel="canonical" href="https://kevinnail.com/blog" />
      </Helmet>
      <div className="blog-page">
        <Banner />
        <AdminLinkRow to="/dashboard?tab=blog" label="← Blog dashboard" />
        <main className="blog-page-content">
          <div className="blog-page-header">
            <h1 className="blog-page-title">Blog</h1>
            {categories.length > 0 && (
              <select
                value={selectedCategory}
                onChange={handleCategoryChange}
                aria-label="Filter by category"
                className="blog-category-filter"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            )}
          </div>

          {status === 'loading' && <p className="blog-page-message">Loading posts…</p>}
          {status === 'error' && <p className="blog-page-error">Could not load the blog.</p>}
          {status === 'ready' && visiblePosts.length === 0 && (
            <p className="blog-page-message">
              {selectedCategory ? 'No posts in this category yet.' : 'No posts yet.'}
            </p>
          )}

          {visiblePosts.length > 0 && (
            <ul className="blog-post-list">
              {visiblePosts.map((post) => (
                <li key={post.slug} className="blog-card">
                  <h2 className="blog-card-title">
                    <Link to={`/blog/${post.slug}`} className="blog-card-link">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="blog-card-summary">{post.summary}</p>
                  <p className="blog-card-details">
                    {formatBlogDate(post.publishedAt)} in {post.category}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    </>
  );
};

export default BlogPage;
