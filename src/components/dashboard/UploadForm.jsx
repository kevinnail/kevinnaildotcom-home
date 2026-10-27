import { useState } from 'react';
import { requestUpload, uploadToS3, savePhoto, SessionExpiredError } from '../../api/mediaApi';

const initialFields = { alt: '', caption: '' };

// Single-file upload for the astronomy gallery. Backpacking uses BulkUploadForm
// (multi-file + EXIF), so this form has no gallery/coordinate handling.
export default function UploadForm({ token, onUploaded, onSessionExpired }) {
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(initialFields);
  const [status, setStatus] = useState('idle'); // idle | uploading | error
  const [error, setError] = useState('');

  const updateField = (name) => (event) =>
    setFields((current) => ({ ...current, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) return;
    setStatus('uploading');
    setError('');
    try {
      const { uploadUrl, objectKey, cacheControl } = await requestUpload(token, file, 'astro');
      await uploadToS3(uploadUrl, file, cacheControl);
      const entry = await savePhoto(token, { objectKey, ...fields }, 'astro');
      onUploaded(entry);
      setFile(null);
      setFields(initialFields);
      event.target.reset();
      setStatus('idle');
    } catch (uploadError) {
      if (uploadError instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }
      setError('Upload failed. Please try again.');
      setStatus('error');
    }
  };

  const uploading = status === 'uploading';

  return (
    <form
      onSubmit={handleSubmit}
      className="admin-panel"
    >
      <h3 className="admin-section-title">Upload astronomy photo</h3>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files[0] ?? null)}
        className="admin-file-input"
      />
      <input
        type="text"
        value={fields.alt}
        onChange={updateField('alt')}
        placeholder="Alt text (accessibility)"
        className="admin-input"
      />
      <input
        type="text"
        value={fields.caption}
        onChange={updateField('caption')}
        placeholder="Caption (shown on hover)"
        className="admin-input"
      />
      {error && <p className="admin-error">{error}</p>}
      <button
        type="submit"
        disabled={uploading || !file}
        className="admin-button admin-button-primary"
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
