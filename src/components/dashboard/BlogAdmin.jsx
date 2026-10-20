import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchAdminBlogPosts, createBlogPost, SessionExpiredError } from '../../api/mediaApi';
import './BlogAdmin.css';

const BlogAdmin = ({ token, onSessionExpired }) => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const existingCategories = [...new Set(posts.map((post) => post.category))].sort();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const loadedPosts = await fetchAdminBlogPosts(token);
        if (!active) return;
        setPosts(loadedPosts);
        setStatus('ready');
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof SessionExpiredError) {
          onSessionExpired();
          return;
        }
        console.error('Loading blog posts failed', loadError);
        setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [token, onSessionExpired]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !category.trim()) {
      setCreateError('Title and category are required.');
      return;
    }

    setCreateError('');
    setIsCreating(true);
    try {
      const post = await createBlogPost(token, { title, category });
      navigate(`/dashboard/blog/${post.id}`);
    } catch (submitError) {
      setIsCreating(false);
      if (submitError instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }
      console.error('Creating blog draft failed', submitError);
      setCreateError('Could not create the draft. Please try again.');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="blog-draft-form">
        <h3 className="blog-draft-form-title">New post</h3>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          aria-label="Title"
          disabled={isCreating}
          className="blog-draft-input"
        />
        <input
          type="text"
          list="blog-category-options"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category"
          aria-label="Category"
          disabled={isCreating}
          className="blog-draft-input"
        />
        <datalist id="blog-category-options">
          {existingCategories.map((existingCategory) => (
            <option key={existingCategory} value={existingCategory} />
          ))}
        </datalist>
        {createError && <p className="blog-error">{createError}</p>}
        <button type="submit" disabled={isCreating} className="blog-draft-submit">
          {isCreating ? 'Creating…' : 'Create draft'}
        </button>
      </form>

      <section className="blog-posts">
        <h2 className="blog-posts-title">Posts</h2>
        {status === 'loading' && <p className="blog-posts-message">Loading posts…</p>}
        {status === 'error' && <p className="blog-error">Could not load posts.</p>}
        {status === 'ready' && posts.length === 0 && (
          <p className="blog-posts-message">No posts yet.</p>
        )}
        {posts.length > 0 && (
          <table className="blog-posts-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    <Link to={`/dashboard/blog/${post.id}`} className="blog-posts-title-link">
                      {post.title}
                    </Link>
                  </td>
                  <td>{post.category}</td>
                  <td>{post.publishedAt ? 'Published' : 'Draft'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
};

export default BlogAdmin;
