import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { rateLimit } from './server/middleware/rate-limit.js';
import configRouter from './server/routes/config.js';
import recommendRouter from './server/routes/ai-recommend.js';
import seedPoolRouter from './server/routes/ai-pool.js';
import poiQueryRouter from './server/routes/ai-poi-query.js';
import amapRouter from './server/routes/amap.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS.length
        ? ALLOWED_ORIGINS
        : true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit);

const PORT = process.env.PORT || 3001;

app.use('/api/config', configRouter);
app.use('/api/ai', recommendRouter);
app.use('/api/ai', seedPoolRouter);
app.use('/api/ai', poiQueryRouter);
app.use('/api/amap', amapRouter);

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(__dirname, 'client/dist');
  app.use(express.static(dist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(dist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
