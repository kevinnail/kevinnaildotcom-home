// Errors that carry the response code they should produce. Controllers throw
// these instead of touching `res`, and lib/middleware/error.js reads `status`
// to send them.

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// A rejected payload.
export function badRequest(message) {
  return httpError(400, message);
}

// A route that matched but named no row. Distinct from
// lib/middleware/not-found.js, which is the terminal handler for a URL that
// matched no route at all — that one builds its error from this function too.
export function notFound(message = 'Not Found') {
  return httpError(404, message);
}
