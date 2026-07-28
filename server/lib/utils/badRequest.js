// A rejected-payload error. `status` is what lib/middleware/error.js reads to
// pick the response code, so throwing one of these from a controller is how a
// 400 gets sent without the controller touching `res`.
export default function badRequest(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
