import dotenv from 'dotenv';
dotenv.config();

import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '4050', 10);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`🚀 GPS + OTP Attendance Server listening on 0.0.0.0:${PORT}`);
  console.log(`🌐 Local:    http://localhost:${PORT}`);
  console.log(`📡 Health:   http://localhost:${PORT}/health`);
  console.log(`=======================================================`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
