import { notFound } from '../utils/httpError.js';

// The terminal handler: nothing above it matched this URL. A controller that
// matched a route but found no row throws `notFound()` itself rather than
// reaching here, so both cases now build their error the same way.
export default (req, res, next) => next(notFound());
