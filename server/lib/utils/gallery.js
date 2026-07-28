// Every gallery-scoped route selects its target with `?gallery=`; anything
// outside the caller's allowlist (including an absent param) is a client error,
// not an empty gallery. The allowlist differs per route — photos accept only
// real galleries, presign also accepts the kml prefix.
export default function requireGallery(req, allowedGalleries) {
  const { gallery } = req.query;

  if (!allowedGalleries.includes(gallery)) {
    const error = new Error(`gallery must be one of: ${allowedGalleries.join(', ')}`);
    error.status = 400;
    throw error;
  }

  return gallery;
}
