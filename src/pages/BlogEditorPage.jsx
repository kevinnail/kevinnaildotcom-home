import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import {
  fetchAdminBlogPost,
  fetchAdminBlogPosts,
  updateBlogPost,
  SessionExpiredError,
} from '../api/mediaApi';
import { useAdminToken, signIn, signOut } from '../hooks/adminSession';
import { useBlogEditorStore } from '../stores/blogEditorStore';
import './BlogEditorPage.css';

const BlogEditorPage = () => {
  const { id } = useParams();
  const token = useAdminToken();
  const {
    title,
    category,
    summary,
    blocks,
    loadPost,
    reset,
    setTitle,
    setCategory,
    setSummary,
    addTextBlock,
    removeBlock,
    moveBlock,
    updateText,
  } = useBlogEditorStore();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [existingCategories, setExistingCategories] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { isError, text }
  const [sessionMessage, setSessionMessage] = useState('');
  const [blockPendingRemoval, setBlockPendingRemoval] = useState(null);

  const handleSessionExpired = useCallback(() => {
    setSessionMessage('Session expired, please log in again.');
    signOut();
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    (async () => {
      setStatus('loading');
      try {
        const [post, posts] = await Promise.all([
          fetchAdminBlogPost(token, id),
          fetchAdminBlogPosts(token),
        ]);
        if (!active) return;
        loadPost(post);
        setExistingCategories([...new Set(posts.map((listedPost) => listedPost.category))].sort());
        setStatus('ready');
      } catch (loadError) {
        if (!active) return;
        if (loadError instanceof SessionExpiredError) {
          handleSessionExpired();
          return;
        }
        console.error('Loading blog post failed', loadError);
        setStatus('error');
      }
    })();
    return () => {
      active = false;
      reset();
    };
  }, [token, id, loadPost, reset, handleSessionExpired]);

  const handleSave = async (event) => {
    event.preventDefault();
    if (!title.trim() || !category.trim() || !summary.trim()) {
      setSaveMessage({ isError: true, text: 'Title, category and summary are required.' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      loadPost(await updateBlogPost(token, id, { title, category, summary, blocks }));
      setSaveMessage({ isError: false, text: 'Saved.' });
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }
      console.error('Saving blog post failed', saveError);
      setSaveMessage({ isError: true, text: 'Could not save. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = (block) => {
    if (block.body.trim()) setBlockPendingRemoval(block);
    else removeBlock(block.id);
  };

  const handleConfirmRemove = () => {
    removeBlock(blockPendingRemoval.id);
    setBlockPendingRemoval(null);
  };

  return (
    <>
      <Helmet>
        <title>Edit post | Kevin Nail</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="blog-editor-page">
        <Banner />
        <div className="blog-editor-content">
          <Link to="/dashboard" className="blog-editor-back-link">
            ← Dashboard
          </Link>
          <h1 className="blog-editor-heading">Edit post</h1>

          {sessionMessage && <p className="blog-editor-error">{sessionMessage}</p>}

          {!token && <LoginForm onAuthenticated={signIn} />}
          {token && status === 'loading' && <p className="blog-editor-message">Loading post…</p>}
          {token && status === 'error' && (
            <p className="blog-editor-error">Could not load the post.</p>
          )}

          {token && status === 'ready' && (
            <form onSubmit={handleSave} className="blog-editor-form">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                aria-label="Title"
                disabled={isSaving}
                className="blog-editor-input"
              />
              <input
                type="text"
                list="blog-editor-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Category"
                aria-label="Category"
                disabled={isSaving}
                className="blog-editor-input"
              />
              <datalist id="blog-editor-category-options">
                {existingCategories.map((existingCategory) => (
                  <option key={existingCategory} value={existingCategory} />
                ))}
              </datalist>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Summary for the blog list"
                aria-label="Summary"
                disabled={isSaving}
                className="blog-editor-textarea blog-editor-summary"
              />

              {blocks.map((block, index) => (
                <div key={block.id} className="blog-editor-block">
                  <textarea
                    value={block.body}
                    onChange={(event) => updateText(block.id, event.target.value)}
                    aria-label={`Text block ${index + 1}`}
                    disabled={isSaving}
                    className="blog-editor-textarea"
                  />
                  <p className="blog-editor-hint">
                    Markdown: [link text](https://example.com), **bold**, `code`
                  </p>
                  <div className="blog-editor-block-controls">
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, -1)}
                      disabled={isSaving || index === 0}
                      className="blog-editor-button"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveBlock(block.id, 1)}
                      disabled={isSaving || index === blocks.length - 1}
                      className="blog-editor-button"
                    >
                      Move down
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(block)}
                      disabled={isSaving}
                      className="blog-editor-button blog-editor-remove-button"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addTextBlock}
                disabled={isSaving}
                className="blog-editor-button"
              >
                Add text
              </button>

              {saveMessage && (
                <p className={saveMessage.isError ? 'blog-editor-error' : 'blog-editor-saved'}>
                  {saveMessage.text}
                </p>
              )}
              <button type="submit" disabled={isSaving} className="blog-editor-save-button">
                {isSaving ? 'Saving…' : 'Save'}
              </button>
            </form>
          )}
        </div>
      </div>

      {blockPendingRemoval && (
        <div
          className="blog-editor-confirm-backdrop"
          onClick={() => setBlockPendingRemoval(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Remove this text block?"
        >
          <div className="blog-editor-confirm" onClick={(event) => event.stopPropagation()}>
            <h2 className="blog-editor-confirm-title">Remove this text block?</h2>
            <p className="blog-editor-confirm-message">
              Its text comes out of the post when you save.
            </p>
            <div className="blog-editor-confirm-actions">
              <button
                type="button"
                onClick={() => setBlockPendingRemoval(null)}
                className="blog-editor-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="blog-editor-button blog-editor-remove-button"
                autoFocus
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BlogEditorPage;
