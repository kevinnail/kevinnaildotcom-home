import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import BlogPostBody from '../components/blog/BlogPostBody';
import {
  fetchAdminBlogPost,
  fetchAdminBlogPosts,
  updateBlogPost,
  publishBlogPost,
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
  // The post as the server last returned it, for its slug and publish date.
  const [savedPost, setSavedPost] = useState(null);
  const [existingCategories, setExistingCategories] = useState([]);
  const [view, setView] = useState('edit'); // edit | preview
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null); // { isError, text }
  const [sessionMessage, setSessionMessage] = useState('');
  // { title, message, confirmLabel, isDanger, onConfirm } while the confirmation box is open.
  const [confirmation, setConfirmation] = useState(null);

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
        setSavedPost(post);
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

  const hasRequiredFields = () => {
    if (title.trim() && category.trim() && summary.trim()) return true;
    setSaveMessage({ isError: true, text: 'Title, category and summary are required.' });
    return false;
  };

  // Saves, then runs `afterSave` (publishing) when given; the last response is kept.
  const runSave = async ({ afterSave, successText, failureText }) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      let post = await updateBlogPost(token, id, { title, category, summary, blocks });
      if (afterSave) post = await afterSave();
      loadPost(post);
      setSavedPost(post);
      setSaveMessage({ isError: false, text: successText });
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        handleSessionExpired();
        return;
      }
      console.error(failureText, saveError);
      setSaveMessage({ isError: true, text: `${failureText} Please try again.` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = (event) => {
    event.preventDefault();
    if (!hasRequiredFields()) return;
    runSave({ successText: 'Saved.', failureText: 'Could not save.' });
  };

  const handlePublish = () => {
    if (!hasRequiredFields()) return;
    setConfirmation({
      title: 'Publish this post?',
      message: 'It is saved, goes live on the blog, and stays published.',
      confirmLabel: 'Publish',
      isDanger: false,
      onConfirm: () =>
        runSave({
          afterSave: () => publishBlogPost(token, id),
          successText: 'Published.',
          failureText: 'Could not publish.',
        }),
    });
  };

  const handleRemove = (block) => {
    if (!block.body.trim()) {
      removeBlock(block.id);
      return;
    }
    setConfirmation({
      title: 'Remove this text block?',
      message: 'Its text comes out of the post when you save.',
      confirmLabel: 'Remove',
      isDanger: true,
      onConfirm: () => removeBlock(block.id),
    });
  };

  const handleConfirm = () => {
    confirmation.onConfirm();
    setConfirmation(null);
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

              <div className="blog-editor-view-toggle">
                {['edit', 'preview'].map((viewOption) => (
                  <button
                    key={viewOption}
                    type="button"
                    onClick={() => setView(viewOption)}
                    aria-pressed={view === viewOption}
                    className={`blog-editor-view-button ${view === viewOption ? 'blog-editor-view-button-selected' : ''}`}
                  >
                    {viewOption === 'edit' ? 'Edit' : 'Preview'}
                  </button>
                ))}
              </div>

              {view === 'preview' && <BlogPostBody blocks={blocks} />}

              {view === 'edit' &&
                blocks.map((block, index) => (
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

              {view === 'edit' && (
                <button
                  type="button"
                  onClick={addTextBlock}
                  disabled={isSaving}
                  className="blog-editor-button"
                >
                  Add text
                </button>
              )}

              {saveMessage && (
                <p className={saveMessage.isError ? 'blog-editor-error' : 'blog-editor-saved'}>
                  {saveMessage.text}
                </p>
              )}
              <div className="blog-editor-actions">
                <button type="submit" disabled={isSaving} className="blog-editor-save-button">
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
                {savedPost.publishedAt ? (
                  <Link to={`/blog/${savedPost.slug}`} className="blog-editor-button">
                    View live post
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={isSaving}
                    className="blog-editor-button"
                  >
                    Publish
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>

      {confirmation && (
        <div
          className="blog-editor-confirm-backdrop"
          onClick={() => setConfirmation(null)}
          role="dialog"
          aria-modal="true"
          aria-label={confirmation.title}
        >
          <div className="blog-editor-confirm" onClick={(event) => event.stopPropagation()}>
            <h2
              className={`blog-editor-confirm-title ${confirmation.isDanger ? 'blog-editor-confirm-title-danger' : ''}`}
            >
              {confirmation.title}
            </h2>
            <p className="blog-editor-confirm-message">{confirmation.message}</p>
            <div className="blog-editor-confirm-actions">
              <button
                type="button"
                onClick={() => setConfirmation(null)}
                className="blog-editor-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`blog-editor-button ${confirmation.isDanger ? 'blog-editor-remove-button' : ''}`}
                autoFocus
              >
                {confirmation.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BlogEditorPage;
