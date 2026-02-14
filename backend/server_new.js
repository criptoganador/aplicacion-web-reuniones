import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { corsOptions } from './config/cors.js';
import { initDB } from './db.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import authRoutes from './routes/auth.js';
import meetingsRoutes from './routes/meetings.js';
import fileRoutes from './routes/files.js';

// Import Cloudinary configuration
import './config/cloudinary.js';

const app = express();

// ===================================================================
// MIDDLEWARE
// ===================================================================

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disable CSP for now to allow easier cross-domain media
}));

// CORS
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ===================================================================
// ROUTES
// ===================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ASICME Meet API',
    version: '2.0.0',
    status: 'running',
  });
});

// API routes
app.use('/auth', authRoutes);
app.use('/meetings', meetingsRoutes);
app.use('/', fileRoutes); // File routes (like /upload) are at root as per legacy frontend

// ===================================================================
// ERROR HANDLING
// ===================================================================

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// ===================================================================
// SERVER STARTUP
// ===================================================================

async function startServer() {
  try {
    // Initialize database
    await initDB();
    
    // Start server
    const PORT = config.port;
    app.listen(PORT, () => {
      console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
      console.log(`🌍 Entorno: ${config.nodeEnv}`);
      console.log(`🔗 Frontend: ${config.frontendUrl}`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();

export default app;
