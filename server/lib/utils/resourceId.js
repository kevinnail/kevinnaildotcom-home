import { notFound } from './httpError.js';

// Photo and trip ids are uuids and travel in the URL path.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id can't match any row, but handing it to Postgres raises a
// 22P02 (invalid text representation) that would surface as a 500. It is
// answered as the plain 404 it really is, before any query runs.
export default function requireResourceId(req) {
  const { id } = req.params;

  if (!UUID_PATTERN.test(id)) throw notFound();

  return id;
}
