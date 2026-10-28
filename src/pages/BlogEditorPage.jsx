import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Banner from '../components/layout/Banner';
import LoginForm from '../components/dashboard/LoginForm';
import BlogPostBody from '../components/blog/BlogPostBody';
import {
  fetchAdminBlogPost,
  fetchAdminBlogPosts,
  updateBlogPost,
  publishBlogPost,
  deleteBlogPost,
  addBlogImages,
  setBlogCover,
  removeBlogCover,
  requestUpload,
  uploadToS3,
  SessionExpiredError,
} from '../api/mediaApi';
import { useAdminToken, signIn, signOut } from '../hooks/adminSession';
import { useBlogEditorStore } from '../stores/blogEditorStore';
import { createDisplayImage } from '../utils/resizeImage';
import '../styles/admin.css';
import './BlogEditorPage.css';

const NEW_CATEGORY = 'new-category';

const ImagesBlockEditor = ({
  token,
  postId,
  block,
  disabled,
  setUploadingCount,
  onSessionExpired,
}) => {
  const { addImages, removeImage, moveImage, updateCaption } = useBlogEditorStore();
  const [failedNames, setFailedNames] = useState([]);
  // { done, total } while this group's photos upload.
  const [progress, setProgress] = useState(null);
  const isEmpty = block.images.length === 0;
  const isPickerDisabled = disabled || progress !== null;

  // One file at a time, so photos appear as each finishes and a failure only
  // affects its own file.
  const handleFilesChange = async (event) => {
    const files = [...event.target.files];
    event.target.value = '';
    setFailedNames([]);
    setUploadingCount((count) => count + 1);
    try {
      for (const [index, file] of files.entries()) {
        setProgress({ done: index, total: files.length });
        try {
          const displayImage = await createDisplayImage(file);
          const upload = await requestUpload(token, displayImage, 'blog');
          await uploadToS3(upload.uploadUrl, displayImage, upload.cacheControl);
          addImages(block.id, await addBlogImages(token, postId, [upload.objectKey]));
        } catch (uploadError) {
          if (uploadError instanceof SessionExpiredError) {
            onSessionExpired();
            return;
          }
          console.error(`Uploading ${file.name} failed`, uploadError);
          setFailedNames((names) => [...names, file.name]);
        }
      }
    } finally {
      setProgress(null);
      setUploadingCount((count) => count - 1);
    }
  };

  const pickerText = progress
    ? `Uploading ${progress.done + 1} of ${progress.total}…`
    : isEmpty
      ? 'Choose photos'
      : 'Add more photos';

  return (
    <>
      {block.images.length > 0 && (
        <div className="blog-editor-images">
          {block.images.map((image, imageIndex) => (
            <div key={image.imageId} className="blog-editor-image">
              <img
                src={image.url}
                alt={image.caption || `Photo ${imageIndex + 1}`}
                className="blog-editor-image-thumbnail"
              />
              <input
                type="text"
                value={image.caption}
                onChange={(event) => updateCaption(block.id, image.imageId, event.target.value)}
                placeholder="Caption (optional)"
                aria-label={`Caption for photo ${imageIndex + 1}`}
                disabled={disabled}
                className="blog-editor-input"
              />
              <div className="blog-editor-block-controls">
                <button
                  type="button"
                  onClick={() => moveImage(block.id, image.imageId, -1)}
                  disabled={disabled || imageIndex === 0}
                  className="admin-button"
                >
                  Move left
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(block.id, image.imageId, 1)}
                  disabled={disabled || imageIndex === block.images.length - 1}
                  className="admin-button"
                >
                  Move right
                </button>
                <button
                  type="button"
                  onClick={() => removeImage(block.id, image.imageId)}
                  disabled={disabled}
                  className="admin-button admin-button-danger"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <label
        className={`blog-editor-photo-picker ${isEmpty ? 'blog-editor-photo-picker-empty' : ''} ${isPickerDisabled ? 'blog-editor-photo-picker-disabled' : ''}`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesChange}
          disabled={isPickerDisabled}
          className="blog-editor-file-input"
        />
        <span className="blog-editor-photo-picker-text">{pickerText}</span>
        {isEmpty && !progress && (
          <span className="blog-editor-photo-picker-hint">
            Select one or several. One photo fills the width, two or more sit side by side.
          </span>
        )}
      </label>
      {failedNames.length > 0 && (
        <p className="blog-editor-error">
          Could not upload {failedNames.join(', ')}. Please try again.
        </p>
      )}
    </>
  );
};

// The cover shows on the /blog list card only, never inside the post.
const CoverEditor = ({
  token,
  postId,
  disabled,
  isPublished,
  setUploadingCount,
  onSessionExpired,
}) => {
  const { coverUrl, setCoverUrl } = useBlogEditorStore();
  // The picker's text while a change is in flight, null otherwise.
  const [busyText, setBusyText] = useState(null);
  const [coverError, setCoverError] = useState('');
  const isPickerDisabled = disabled || busyText !== null;

  // Save is held during a cover change, so a save response landing after it
  // can't put the old cover back in the editor.
  const runCoverChange = async (changeCover, { pendingText, failureText }) => {
    setCoverError('');
    setBusyText(pendingText);
    setUploadingCount((count) => count + 1);
    try {
      setCoverUrl(await changeCover());
    } catch (coverChangeError) {
      if (coverChangeError instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }
      console.error(failureText, coverChangeError);
      setCoverError(`${failureText} Please try again.`);
    } finally {
      setBusyText(null);
      setUploadingCount((count) => count - 1);
    }
  };

  const handleFileChange = (event) => {
    const [file] = event.target.files;
    event.target.value = '';
    runCoverChange(
      async () => {
        const displayImage = await createDisplayImage(file);
        const upload = await requestUpload(token, displayImage, 'blog');
        await uploadToS3(upload.uploadUrl, displayImage, upload.cacheControl);
        return (await setBlogCover(token, postId, upload.objectKey)).coverUrl;
      },
      { pendingText: 'Uploading cover…', failureText: 'Could not upload the cover.' },
    );
  };

  const handleRemove = () =>
    runCoverChange(async () => (await removeBlogCover(token, postId)).coverUrl, {
      pendingText: 'Removing cover…',
      failureText: 'Could not remove the cover.',
    });

  const picker = (
    <label
      className={`blog-editor-photo-picker ${coverUrl ? '' : 'blog-editor-photo-picker-empty'} ${isPickerDisabled ? 'blog-editor-photo-picker-disabled' : ''}`}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={isPickerDisabled}
        className="blog-editor-file-input"
      />
      <span className="blog-editor-photo-picker-text">
        {busyText ?? (coverUrl ? 'Replace cover' : 'Choose a cover picture')}
      </span>
      {!coverUrl && !busyText && (
        <span className="blog-editor-photo-picker-hint">
          Shown on the blog list card, not inside the post.
        </span>
      )}
    </label>
  );

  return (
    <div className="blog-editor-block">
      {coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt="Cover for the blog list"
            className="blog-editor-cover-thumbnail"
          />
          <div className="blog-editor-block-controls">
            {picker}
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPickerDisabled || isPublished}
              className="admin-button admin-button-danger"
            >
              Remove cover
            </button>
          </div>
          {isPublished && (
            <p className="blog-editor-hint">
              A published post keeps its cover; replace it instead.
            </p>
          )}
        </>
      ) : (
        picker
      )}
      {coverError && <p className="blog-editor-error">{coverError}</p>}
    </div>
  );
};

const BlogEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = useAdminToken();
  const {
    title,
    category,
    summary,
    coverUrl,
    blocks,
    loadPost,
    reset,
    setTitle,
    setCategory,
    setSummary,
    addTextBlock,
    addImagesBlock,
    removeBlock,
    moveBlock,
    updateText,
  } = useBlogEditorStore();
  const [status, setStatus] = useState('loading'); // loading | ready | error
  // The post as the server last returned it, for its slug and publish date.
  const [savedPost, setSavedPost] = useState(null);
  const [existingCategories, setExistingCategories] = useState([]);
  // True while "New category…" is picked and the category is typed instead.
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [view, setView] = useState('edit'); // edit | preview
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState(null); // { isError, text }
  const [sessionMessage, setSessionMessage] = useState('');
  // { title, message, confirmLabel, isDanger, onConfirm } while the confirmation box is open.
  const [confirmation, setConfirmation] = useState(null);

  const handleSessionExpired = useCallback(() => {
    setSessionMessage('Session expired, please log in again.');
    signOut();
  }, []);

  // The session-expired message is only true until the next sign-in.
  const handleAuthenticated = (newToken) => {
    setSessionMessage('');
    signIn(newToken);
  };

  // A save during an upload would delete the photo the server just stored,
  // because the blocks being saved don't reference it yet.
  const isUploading = uploadingCount > 0;

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

  const handleCategoryChange = (event) => {
    const isNew = event.target.value === NEW_CATEGORY;
    setIsNewCategory(isNew);
    setCategory(isNew ? '' : event.target.value);
  };

  const hasRequiredFields = () => {
    if (title.trim() && category.trim() && summary.trim() && coverUrl) return true;
    setSaveMessage({
      isError: true,
      text: 'Title, category, summary and cover picture are required.',
    });
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
      // A new category is now an existing one, under the spelling the server kept.
      setExistingCategories((categories) => [...new Set([...categories, post.category])].sort());
      setIsNewCategory(false);
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

  const handleDelete = () => {
    setConfirmation({
      title: 'Delete this post?',
      message: 'The post and its photos are removed for good. This cannot be undone.',
      confirmLabel: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        setIsSaving(true);
        setSaveMessage(null);
        try {
          await deleteBlogPost(token, id);
          navigate('/dashboard?tab=blog');
        } catch (deleteError) {
          if (deleteError instanceof SessionExpiredError) {
            handleSessionExpired();
            return;
          }
          console.error('Could not delete.', deleteError);
          setSaveMessage({ isError: true, text: 'Could not delete. Please try again.' });
        } finally {
          setIsSaving(false);
        }
      },
    });
  };

  const handleRemove = (block) => {
    const isImages = block.type === 'images';
    if (isImages ? block.images.length === 0 : !block.body.trim()) {
      removeBlock(block.id);
      return;
    }
    setConfirmation({
      title: isImages ? 'Remove this photo group?' : 'Remove this text block?',
      message: isImages
        ? 'Its photos come out of the post when you save.'
        : 'Its text comes out of the post when you save.',
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
          <div className="admin-toolbar">
            <div className="admin-toolbar-row">
              <Link to="/dashboard?tab=blog" className="admin-nav-link">
                ← Dashboard
              </Link>
              {token && status === 'ready' && (
                <>
                  <div className="admin-toggle">
                    {['edit', 'preview'].map((viewOption) => (
                      <button
                        key={viewOption}
                        type="button"
                        onClick={() => setView(viewOption)}
                        aria-pressed={view === viewOption}
                        className={`admin-toggle-option ${view === viewOption ? 'admin-toggle-option-selected' : ''}`}
                      >
                        {viewOption === 'edit' ? 'Edit' : 'Preview'}
                      </button>
                    ))}
                  </div>
                  <div className="admin-toolbar-actions">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving || isUploading}
                      className="admin-button admin-button-danger blog-editor-delete-button"
                    >
                      Delete{' '}
                    </button>
                    {savedPost.publishedAt ? (
                      <Link to={`/blog/${savedPost.slug}`} className="admin-button">
                        View live post
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePublish}
                        disabled={isSaving || isUploading}
                        className="admin-button"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      type="submit"
                      form="blog-editor-form"
                      disabled={isSaving || isUploading}
                      className="admin-button admin-button-primary"
                    >
                      {isUploading ? 'Uploading…' : isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </>
              )}
            </div>
            {token && status === 'ready' && saveMessage && (
              <p className={saveMessage.isError ? 'blog-editor-error' : 'blog-editor-saved'}>
                {saveMessage.text}
              </p>
            )}
          </div>
          <h1 className="admin-page-title">Edit post</h1>

          {sessionMessage && <p className="blog-editor-error">{sessionMessage}</p>}

          {!token && <LoginForm onAuthenticated={handleAuthenticated} />}
          {token && status === 'loading' && <p className="blog-editor-message">Loading post…</p>}
          {token && status === 'error' && (
            <p className="blog-editor-error">Could not load the post.</p>
          )}

          {token && status === 'ready' && (
            <form id="blog-editor-form" onSubmit={handleSave} className="blog-editor-form">
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                aria-label="Title"
                disabled={isSaving}
                className="blog-editor-input"
              />
              <select
                value={isNewCategory ? NEW_CATEGORY : category}
                onChange={handleCategoryChange}
                aria-label="Category"
                disabled={isSaving}
                className="blog-editor-input"
              >
                {existingCategories.map((existingCategory) => (
                  <option key={existingCategory} value={existingCategory}>
                    {existingCategory}
                  </option>
                ))}
                <option value={NEW_CATEGORY}>New category…</option>
              </select>
              {isNewCategory && (
                <input
                  type="text"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="New category"
                  aria-label="New category"
                  autoComplete="off"
                  autoFocus
                  disabled={isSaving}
                  className="blog-editor-input"
                />
              )}
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder="Summary for the blog list"
                aria-label="Summary"
                disabled={isSaving}
                className="blog-editor-textarea blog-editor-summary"
              />
              <CoverEditor
                token={token}
                postId={id}
                disabled={isSaving}
                isPublished={Boolean(savedPost.publishedAt)}
                setUploadingCount={setUploadingCount}
                onSessionExpired={handleSessionExpired}
              />

              {view === 'preview' && <BlogPostBody title={title} blocks={blocks} />}

              {view === 'edit' &&
                blocks.map((block, index) => (
                  <div key={block.id} className="blog-editor-block">
                    {block.type === 'images' ? (
                      <ImagesBlockEditor
                        token={token}
                        postId={id}
                        block={block}
                        disabled={isSaving}
                        setUploadingCount={setUploadingCount}
                        onSessionExpired={handleSessionExpired}
                      />
                    ) : (
                      <>
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
                      </>
                    )}
                    <div className="blog-editor-block-controls">
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, -1)}
                        disabled={isSaving || index === 0}
                        className="admin-button"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(block.id, 1)}
                        disabled={isSaving || index === blocks.length - 1}
                        className="admin-button"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(block)}
                        disabled={isSaving}
                        className="admin-button admin-button-danger"
                      >
                        {block.type === 'images' ? 'Remove photo group' : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}

              {view === 'edit' && (
                <div className="blog-editor-block-controls">
                  <button
                    type="button"
                    onClick={addTextBlock}
                    disabled={isSaving}
                    className="admin-button"
                  >
                    Add text
                  </button>
                  <button
                    type="button"
                    onClick={addImagesBlock}
                    disabled={isSaving}
                    className="admin-button"
                  >
                    Add photos
                  </button>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {confirmation && (
        <div
          className="admin-confirm-backdrop"
          onClick={() => setConfirmation(null)}
          role="dialog"
          aria-modal="true"
          aria-label={confirmation.title}
        >
          <div className="admin-confirm" onClick={(event) => event.stopPropagation()}>
            <h2
              className={`admin-confirm-title ${confirmation.isDanger ? 'admin-confirm-title-danger' : ''}`}
            >
              {confirmation.title}
            </h2>
            <p className="admin-confirm-message">{confirmation.message}</p>
            <div className="admin-confirm-actions">
              <button type="button" onClick={() => setConfirmation(null)} className="admin-button">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`admin-button ${confirmation.isDanger ? 'admin-button-danger' : 'admin-button-primary'}`}
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
