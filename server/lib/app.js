import express from 'express';
import cors from 'cors';
import health from './controllers/health.js';
import notFound from './middleware/not-found.js';
import errorHandler from './middleware/error.js';

const app = express();
app.set('trust proxy', 1);

// Built in middleware
app.use(express.json());

app.use(
  cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true,
  }),
);

// App routes
app.use('/api/v1/health', health);

// Error handling & 404 middleware for when
// a request doesn't match any app routes
app.use(notFound);
app.use(errorHandler);

export default app;
