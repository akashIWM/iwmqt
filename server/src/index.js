import http from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

// 1. THIS IS NOW UNCOMMENTED
import authRoutes from './routes/auth.routes.js'; 
import adminRoutes from './routes/admin.routes.js';
import { initMarketDataSocket } from './services/marketData.service.js';
import orderRoutes from './routes/order.routes.js';
import positionRoutes from './routes/position.routes.js';
import rmsRoutes from './routes/rms.routes.js';

dotenv.config();

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

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'Platform API is running' });
});

// 2. THIS IS NOW UNCOMMENTED
app.use('/api/auth', authRoutes);

// 3. MOUNT THE ADMIN ROUTES
app.use('/api/admin', adminRoutes);

app.use('/api/orders', orderRoutes);

// Create HTTP server & attach WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/market-data' });

initMarketDataSocket(wss);

server.listen(PORT, () => {
  console.log(`✅ iwmQT Backend Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready on ws://localhost:${PORT}/ws/market-data`);
});