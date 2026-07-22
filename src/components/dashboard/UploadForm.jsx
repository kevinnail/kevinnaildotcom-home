import { useState } from 'react';
import { requestUpload, uploadToS3, savePhoto, SessionExpiredError } from '../../lib/mediaApi';
import { readPhotoMeta } from '../../lib/exif';

const initialFields = { alt: '', caption: '', lat: '', lng: '' };

const inputClass =
  'px-3 py-2 rounded bg-black text-white border border-mid-gray focus:border-neon-blue outline-none';

// Parse a coordinate text input into a number, or null when blank/invalid.
function parseCoordinate(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function UploadForm({ token, gallery, onUploaded, onSessionExpired }) {
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(initialFields);
  const [takenAt, setTakenAt] = useState(null); // EXIF capture time (hikes)
  const [metaNote, setMetaNote] = useState('');
  const [status, setStatus] = useState('idle'); // idle | uploading | error
  const [error, setError] = useState('');

  const isHikes = gallery === 'hikes';

  const updateField = (name) => (event) =>
    setFields((current) => ({ ...current, [name]: event.target.value }));

  // For hikes, pull GPS + capture time from EXIF and prefill; manual entry stays
  // available as the fallback for photos without embedded location.
  const handleFileChange = async (event) => {
    const selected = event.target.files[0] ?? null;
    setFile(selected);
    setTakenAt(null);
    setMetaNote('');
    if (!selected || !isHikes) return;

    const meta = await readPhotoMeta(selected);
    setTakenAt(meta.takenAt);
    const hasGps = meta.lat != null && meta.lng != null;
    if (hasGps) {
      setFields((current) => ({ ...current, lat: String(meta.lat), lng: String(meta.lng) }));
    }
    setMetaNote(
      hasGps
        ? `Location read from photo${meta.takenAt ? ' + capture time' : ''}.`
        : 'No GPS in photo — enter coordinates manually.',
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) return;
    setStatus('uploading');
    setError('');
    try {
      const { uploadUrl, objectKey } = await requestUpload(token, file, gallery);
      await uploadToS3(uploadUrl, file);
      const metadata = { objectKey, alt: fields.alt, caption: fields.caption };
      if (isHikes) {
        metadata.lat = parseCoordinate(fields.lat);
        metadata.lng = parseCoordinate(fields.lng);
        metadata.takenAt = takenAt;
      }
      const entry = await savePhoto(token, metadata, gallery);
      onUploaded(entry);
      setFile(null);
      setFields(initialFields);
      setTakenAt(null);
      setMetaNote('');
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
      <h3 className="text-neon-blue font-display text-xl">
        {isHikes ? 'Upload backpacking photo' : 'Upload astronomy photo'}
      </h3>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="text-white text-sm"
      />
      <input
        type="text"
        value={fields.alt}
        onChange={updateField('alt')}
        placeholder={isHikes ? 'Alt text (optional)' : 'Alt text (accessibility)'}
        className={inputClass}
      />
      <input
        type="text"
        value={fields.caption}
        onChange={updateField('caption')}
        placeholder={isHikes ? 'Caption (optional)' : 'Caption (shown on hover)'}
        className={inputClass}
      />
      {isHikes && (
        <>
          <div className="flex gap-3">
            <input
              type="number"
              step="any"
              value={fields.lat}
              onChange={updateField('lat')}
              placeholder="Latitude"
              className={`${inputClass} w-1/2`}
            />
            <input
              type="number"
              step="any"
              value={fields.lng}
              onChange={updateField('lng')}
              placeholder="Longitude"
              className={`${inputClass} w-1/2`}
            />
          </div>
          {metaNote && <p className="text-mid-gray text-xs">{metaNote}</p>}
        </>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={uploading || !file}
        className="px-4 py-2 rounded bg-neon-blue-50 text-white font-bold disabled:opacity-50 self-start"
      >
        {uploading ? 'Uploading…' : 'Upload'}
      </button>
    </form>
  );
}
