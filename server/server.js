const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');

dotenv.config();

const authRoutes         = require('./routes/auth.routes');
const adminRoutes        = require('./routes/admin.routes');
const proposalRoutes     = require('./routes/proposal.routes');
const repositoryRoutes   = require('./routes/repository.routes');
const notificationRoutes = require('./routes/notification.routes');
const grantRoutes        = require('./routes/grant.routes');
const externalRoutes     = require('./routes/external.routes');
const reportRoutes       = require('./routes/report.routes');
const signatureRoutes    = require('./routes/signature.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// Gather all allowed origins (defaults + .env values)
const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : [];

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://10.12.76.138:3000',
  ...envOrigins
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (Postman, curl) or matched origins
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://10.') || origin.startsWith('http://192.168.')) {
      return callback(null, true);
    } else {
      console.warn('Blocked by CORS:', origin);
      return callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 2 MB: enough for a signature image (1 MB at most) sent as text
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/proposals',     proposalRoutes);
app.use('/api/repository',    repositoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/grants',        grantRoutes);
app.use('/api/external',      externalRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/signatures',    signatureRoutes);

app.get('/', (req, res) => res.send('AYON API is running.'));

app.listen(PORT, () => console.log('Server started on port ' + PORT));