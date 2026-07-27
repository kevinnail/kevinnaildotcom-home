import { verifyAdminToken, TOKEN_ERROR_NAMES } from '../utils/token.js';

// Protected routes carry the admin token as `Authorization: Bearer <token>`.
// Every client-side failure is a 401, which is load-bearing: mediaApi.js turns a
// 401 on an authed call into SessionExpiredError and forces a re-login.
export default (req, res, next) => {
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '');

  if (!bearerMatch) {
    const error = new Error('Missing bearer token');
    error.status = 401;
    return next(error);
  }

  let payload;
  try {
    payload = verifyAdminToken(bearerMatch[1]);
  } catch (verifyError) {
    // A misconfigured JWT_SECRET is a server fault; reporting it as an expired
    // session would send the admin re-logging in against a broken deploy.
    if (!TOKEN_ERROR_NAMES.includes(verifyError.name)) return next(verifyError);

    const error = new Error('Invalid or expired token');
    error.status = 401;
    error.cause = verifyError;
    return next(error);
  }

  req.user = { id: payload.sub, username: payload.username };
  next();
};
