import { useState } from 'react';
import { requestUpload, uploadToS3, savePhoto, SessionExpiredError } from '../../lib/mediaApi';

const initialFields = { alt: '', caption: '' };

const inputClass =
  'px-3 py-2 rounded bg-black text-white border border-mid-gray focus:border-neon-blue-bright outline-none';

const fileInputClass =
  'text-white text-sm cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-neon-blue file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-neon-blue-bright hover:file:text-black';

const submitButtonClass =
  'px-4 py-2 rounded bg-neon-blue text-white font-bold cursor-pointer hover:bg-neon-blue-bright hover:text-black disabled:bg-neutral-700 disabled:text-neutral-300 disabled:cursor-not-allowed self-start';

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
      const { uploadUrl, objectKey } = await requestUpload(token, file);
      await uploadToS3(uploadUrl, file);
      const entry = await savePhoto(token, { objectKey, ...fields });
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
      className="flex flex-col gap-3 bg-neutral-900 p-5 rounded-lg border border-neon-blue-50"
    >
      <h3 className="text-neon-blue-bright font-display text-xl">Upload astronomy photo</h3>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => setFile(event.target.files[0] ?? null)}
        className={fileInputClass}
      />
      <input
        type="text"
        value={fields.alt}
        onChange={updateField('alt')}
        placeholder="Alt text (accessibility)"
        className={inputClass}
      />
      <input
        type="text"
        value={fields.caption}
        onChange={updateField('caption')}
        placeholder="Caption (shown on hover)"
        className={inputClass}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={uploading || !file} className={submitButtonClass}>
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
