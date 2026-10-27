import { useState } from 'react';
import {
  requestUpload,
  uploadToS3,
  savePhotosBatch,
  SessionExpiredError,
} from '../../api/mediaApi';
import { readPhotoMeta } from '../../utils/exif';
import { createDisplayImage, createThumbnail } from '../../utils/resizeImage';
import { mapWithConcurrency } from '../../utils/concurrency';

const MAX_BATCH = 500; // must match the Lambda's per-batch cap
const UPLOAD_CONCURRENCY = 5;

// Trip dropdown sentinels. The default is NO_TRIP_SELECTED (a disabled placeholder)
// so submit stays locked until the uploader makes a deliberate choice — this stops
// accidental unassigned uploads. UNASSIGNED is a real, chosen value that maps to a
// null tripId, so leaving photos unassigned is possible but only on purpose.
const NO_TRIP_SELECTED = '';
const UNASSIGNED = 'unassigned';

export default function BulkUploadForm({ token, trips = [], onUploaded, onSessionExpired }) {
  const [files, setFiles] = useState([]);
  const [tripId, setTripId] = useState(NO_TRIP_SELECTED);
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

  // Read EXIF, build the two web-sized renditions, and PUT both to S3. The camera
  // original is never uploaded — it is only ever the source the other two are
  // derived from, and EXIF is read from it first so the resize can safely strip
  // metadata. Resolves to a result object so one bad file doesn't abort the batch;
  // a session-expiry still throws so the whole run aborts and forces re-login. A
  // photo whose renditions can't be built fails here, so every saved entry has a
  // real thumbUrl — the sidebar never falls back to a full-size image.
  const uploadOne = async (file) => {
    try {
      const meta = await readPhotoMeta(file);
      const displayImage = await createDisplayImage(file);
      const thumbnail = await createThumbnail(file);

      const display = await requestUpload(token, displayImage, 'hikes');
      const thumb = await requestUpload(token, thumbnail, 'hikes');
      await uploadToS3(display.uploadUrl, displayImage, display.cacheControl);
      await uploadToS3(thumb.uploadUrl, thumbnail, thumb.cacheControl);

      return {
        ok: true,
        item: {
          objectKey: display.objectKey,
          thumbObjectKey: thumb.objectKey,
          takenAt: meta.takenAt,
          lat: meta.lat,
          lng: meta.lng,
        },
      };
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
        const items = successfulItems.map((item) => ({
          ...item,
          tripId: tripId === UNASSIGNED ? null : tripId,
        }));
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
      className="admin-panel"
    >
      <h3 className="admin-section-title">Upload backpacking photos</h3>
      <p className="admin-text">
        Select many at once. Location and capture time are read from each photo; add captions or
        fix coordinates afterward by editing a photo.
      </p>
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFilesChange}
        className="admin-file-input"
      />

      <select
        value={tripId}
        onChange={(event) => setTripId(event.target.value)}
        disabled={uploading}
        aria-label="Trip"
        className="admin-input"
      >
        <option value={NO_TRIP_SELECTED} disabled>
          Choose a trip…
        </option>
        <option value={UNASSIGNED}>Unassigned</option>
        {trips.map((trip) => (
          <option key={trip.id} value={trip.id}>
            {trip.name}
            {trip.region ? ` (${trip.region})` : ''}
          </option>
        ))}
      </select>

      {uploading && (
        <p className="admin-text">
          Uploading {completed}/{files.length}…
        </p>
      )}

      {status === 'done' && (
        <p className="admin-text">
          Uploaded {savedCount}
          {failedNames.length > 0 && ` · failed ${failedNames.length}`}
        </p>
      )}

      {failedNames.length > 0 && (
        <p className="admin-error">Failed: {failedNames.join(', ')}</p>
      )}
      {error && <p className="admin-error">{error}</p>}

      <button
        type="submit"
        disabled={uploading || files.length === 0 || tripId === NO_TRIP_SELECTED}
        className="admin-button admin-button-primary"
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
