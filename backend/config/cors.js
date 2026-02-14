import { config } from './index.js';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  config.frontendUrl,
].filter(Boolean);

export const corsOptions = {
  origin: function (origin, callback) {
    console.log(
      `🔍 CORS attempt from: ${origin || 'no-origin'} | Allowed: ${JSON.stringify(allowedOrigins)}`
    );

    if (
      !origin ||
      allowedOrigins.indexOf(origin) !== -1 ||
      config.nodeEnv !== 'production'
    ) {
      callback(null, true);
    } else {
      console.warn(`❌ CORS blocked for: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};
