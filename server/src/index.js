import http from 'http';
import 'dotenv/config';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

// 1. THIS IS NOW UNCOMMENTED
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { initMarketDataSocket } from './services/marketData.service.js';
import orderRoutes from './routes/order.routes.js';
import positionRoutes from './routes/position.routes.js';
import rmsRoutes from './routes/rms.routes.js';
import killSwitchRoutes from './routes/kill-switch.routes.js';
import omsConfigRoutes from './routes/oms-config.routes.js';
import auditRoutes from './routes/audit.routes.js';
import companyRoutes from './routes/company.routes.js';
import securityLimitsRoutes from './routes/security-limits.routes.js';
import serversRoutes from './routes/servers.routes.js';
import strategyFeedRoutes from './routes/strategyFeed.routes.js';
import limitRequestsRoutes from './routes/limitRequests.routes.js';
import algoStrategyRoutes from './routes/algoStrategy.routes.js';
import { refreshAllRmsCaches } from './services/rmsConfigCache.service.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true, 
}));

app.use('/api/positions', positionRoutes);
app.use('/api/rms', rmsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/kill-switch', killSwitchRoutes);
app.use('/api/oms-config', omsConfigRoutes);
app.use('/api/audit-log', auditRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/security-limits', securityLimitsRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/strategy-feed', strategyFeedRoutes);
app.use('/api/limit-requests', limitRequestsRoutes);
app.use('/api/strategies', algoStrategyRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Platform API is running' });
});

// 2. THIS IS NOW UNCOMMENTED
app.use('/api/auth', authRoutes);

app.use('/api/orders', orderRoutes);

// Create HTTP server & attach WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/market-data' });

initMarketDataSocket(wss);

// Load the RMS config cache (oms_config, banned_scripts, kill_switches, security_limits)
// before accepting traffic, so the very first order placement doesn't hit an empty cache.
await refreshAllRmsCaches();

server.listen(PORT, () => {
  console.log(`✅ iwmQT Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}/ws/market-data`);
});