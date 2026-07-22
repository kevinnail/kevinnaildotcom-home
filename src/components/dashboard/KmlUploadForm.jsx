import { useState } from 'react';
import { requestUpload, uploadToS3, saveKml, SessionExpiredError } from '../../lib/mediaApi';

const KML_CONTENT_TYPE = 'application/vnd.google-earth.kml+xml';
const initialFields = { name: '', region: '' };

const inputClass =
  'px-3 py-2 rounded bg-black text-white border border-mid-gray focus:border-neon-blue outline-none';

// Upload a .kml trail file as a map trip. Bytes go straight to S3 under kml/ via
// the presigned PUT; saveKml records the trip in the manifest the map reads.
export default function KmlUploadForm({ token, onUploaded, onSessionExpired }) {
  const [file, setFile] = useState(null);
  const [fields, setFields] = useState(initialFields);
  const [status, setStatus] = useState('idle'); // idle | uploading | error
  const [error, setError] = useState('');

  const updateField = (name) => (event) =>
    setFields((current) => ({ ...current, [name]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.kml')) {
      setError('Please choose a .kml file.');
      setStatus('error');
      return;
    }
    if (!fields.name.trim()) {
      setError('A trip name is required.');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setError('');
    try {
      // Browsers often report an empty MIME type for .kml. Re-wrap the file with a
      // correct type so the presigned PUT and the stored object both carry it.
      const typedFile = new File([file], file.name, { type: KML_CONTENT_TYPE });
      const { uploadUrl, objectKey } = await requestUpload(token, typedFile, 'kml');
      await uploadToS3(uploadUrl, typedFile);
      const entry = await saveKml(token, {
        objectKey,
        name: fields.name.trim(),
        region: fields.region.trim(),
      });
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
      <h3 className="text-neon-blue font-display text-xl">Upload trail (KML)</h3>
      <input
        type="file"
        accept=".kml"
        onChange={(event) => setFile(event.target.files[0] ?? null)}
        className="text-white text-sm"
      />
      <input
        type="text"
        value={fields.name}
        onChange={updateField('name')}
        placeholder="Trip name"
        className={inputClass}
      />
      <input
        type="text"
        value={fields.region}
        onChange={updateField('region')}
        placeholder="Region (e.g. Cascades, WA)"
        className={inputClass}
      />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={uploading || !file}
        className="px-4 py-2 rounded bg-neon-blue-50 text-white font-bold disabled:opacity-50 self-start"
      >
        {uploading ? 'Uploading…' : 'Upload trail'}
      </button>
    </form>
  );
}
