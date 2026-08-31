import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { pool, initDatabase } from './db';
import { initTrackingSocket } from './websocket/trackingSocket';

const server = http.createServer(app);

// Initialize Socket.IO with WebSocket Handshake Security
export const io = initTrackingSocket(server);

// Boot sequence: verify schema then start listening
async function start() {
  await initDatabase();

  server.listen(env.PORT, () => {
    console.log(`========================================================`);
    console.log(` SafeGuard SOS Backend Server Active`);
    console.log(` Environment : ${env.NODE_ENV}`);
    console.log(` Port        : ${env.PORT}`);
    console.log(` DB URL      : ${env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);
    console.log(` CORS Origins: ${env.CORS_ORIGINS}`);
    console.log(`========================================================`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start server:', err);
  process.exit(1);
});

// Graceful Shutdown
const shutdown = async () => {
  console.log('[Server] Graceful shutdown initiated...');
  server.close(() => {
    console.log('[Server] HTTP server closed');
  });
  await pool.end();
  console.log('[Server] PostgreSQL connection pool closed');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { server };
