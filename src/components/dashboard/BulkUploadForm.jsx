import { useState } from 'react';
import {
  requestUpload,
  uploadToS3,
  savePhotosBatch,
  SessionExpiredError,
} from '../../lib/mediaApi';
import { readPhotoMeta } from '../../lib/exif';
import { mapWithConcurrency } from '../../lib/concurrency';

const MAX_BATCH = 500; // must match the Lambda's per-batch cap
const UPLOAD_CONCURRENCY = 5;

const fileInputClass =
  'text-white text-sm cursor-pointer file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-neon-blue file:px-4 file:py-2 file:font-bold file:text-white hover:file:bg-neon-blue-bright hover:file:text-black';

const submitButtonClass =
  'px-4 py-2 rounded bg-neon-blue text-white font-bold cursor-pointer hover:bg-neon-blue-bright hover:text-black disabled:bg-neutral-700 disabled:text-neutral-300 disabled:cursor-not-allowed self-start';

export default function BulkUploadForm({ token, trips = [], onUploaded, onSessionExpired }) {
  const [files, setFiles] = useState([]);
  const [tripId, setTripId] = useState(''); // '' = Unassigned
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [completed, setCompleted] = useState(0);
  const [failedNames, setFailedNames] = useState([]);
  const [savedCount, setSavedCount] = useState(0);
  const [error, setError] = useState('');

  const resetSummary = () => {
    setStatus('idle');
    setCompleted(0);
    setFailedNames([]);
    setSavedCount(0);
    setError('');
  };

  const handleFilesChange = (event) => {
    setFiles(Array.from(event.target.files ?? []));
    resetSummary();
  };

  // Read EXIF, get a presigned URL, and PUT the bytes to S3. Resolves to a result
  // object so one bad file doesn't abort the batch; a session-expiry still throws
  // so the whole run aborts and forces re-login.
  const uploadOne = async (file) => {
    try {
      const meta = await readPhotoMeta(file);
      const { uploadUrl, objectKey, cacheControl } = await requestUpload(token, file, 'hikes');
      await uploadToS3(uploadUrl, file, cacheControl);
      return { ok: true, item: { objectKey, takenAt: meta.takenAt, lat: meta.lat, lng: meta.lng } };
    } catch (uploadError) {
      if (uploadError instanceof SessionExpiredError) throw uploadError;
      return { ok: false, name: file.name };
    } finally {
      setCompleted((current) => current + 1);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (files.length === 0) return;
    if (files.length > MAX_BATCH) {
      setError(`Select at most ${MAX_BATCH} photos at once.`);
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setCompleted(0);
    setFailedNames([]);
    setError('');

    try {
      const results = await mapWithConcurrency(files, UPLOAD_CONCURRENCY, uploadOne);
      const successfulItems = results.filter((result) => result.ok).map((result) => result.item);
      const failed = results.filter((result) => !result.ok).map((result) => result.name);

      if (successfulItems.length > 0) {
        // Every photo in the batch is assigned to the one trip picked above ('' =>
        // null, i.e. unassigned). Orphan risk (accepted for v1): the bytes are
        // already in S3 by this point, so if this single save fails those objects
        // exist without a manifest entry and must be cleaned up manually. The
        // upfront MAX_BATCH guard avoids the most likely cause (an oversized batch).
        const items = successfulItems.map((item) => ({ ...item, tripId: tripId || null }));
        const entries = await savePhotosBatch(token, items, 'hikes');
        onUploaded(entries);
        setSavedCount(entries.length);
      }
      setFailedNames(failed);
      setStatus('done');
      setFiles([]);
      event.target.reset();
    } catch (batchError) {
      if (batchError instanceof SessionExpiredError) {
        onSessionExpired();
        return;
      }
      setError('Bulk upload failed. Some photos may not have been saved.');
      setStatus('error');
    }
  };

  const uploading = status === 'uploading';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 bg-neutral-900 p-5 rounded-lg border border-neon-blue-50"
    >
      <h3 className="text-neon-blue-bright font-display text-xl">Upload backpacking photos</h3>
      <p className="text-neutral-400 text-xs">
        Select many at once — location and capture time are read from each photo. Add captions or
        fix coordinates afterward by editing a photo.
      </p>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        className={fileInputClass}
      />

      <label className="flex flex-col gap-1 text-neutral-400 text-xs">
        Trip
        <select
          value={tripId}
          onChange={(event) => setTripId(event.target.value)}
          disabled={uploading}
          className="rounded border border-mid-gray bg-black px-2 py-1.5 text-sm text-white outline-none focus:border-neon-blue-bright disabled:cursor-not-allowed disabled:text-neutral-500"
        >
          <option value="">Unassigned</option>
          {trips.map((trip) => (
            <option key={trip.id} value={trip.id}>
              {trip.name}
              {trip.region ? ` — ${trip.region}` : ''}
            </option>
          ))}
        </select>
      </label>

      {uploading && (
        <p className="text-neutral-400 text-sm">
          Uploading {completed}/{files.length}…
        </p>
      )}

      {status === 'done' && (
        <p className="text-sm text-neutral-400">
          Uploaded {savedCount}
          {failedNames.length > 0 && ` · failed ${failedNames.length}`}
        </p>
      )}

      {failedNames.length > 0 && (
        <p className="text-red-400 text-xs break-words">Failed: {failedNames.join(', ')}</p>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={uploading || files.length === 0}
        className={submitButtonClass}
      >
        {uploading
          ? 'Uploading…'
          : files.length > 0
            ? `Upload ${files.length} photo${files.length === 1 ? '' : 's'}`
            : 'Upload'}
      </button>
    </form>
  );
}
