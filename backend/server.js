import app from './src/app.js';
import config from './src/config/index.js';
import storageService from './src/services/storageService.js';

async function startServer() {
  try {
    // Ensure storage files and directory are initialized
    await storageService.initStorage();

    const server = app.listen(config.port, () => {
      console.log(`Clinic Booking API running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Storage directory: ${config.dataDir}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });

    const shutdown = () => {
      console.log('Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

