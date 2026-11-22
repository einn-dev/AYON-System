const express = require('express');
const cors    = require('cors');
const dotenv  = require('dotenv');

dotenv.config();

const authRoutes         = require('./routes/auth.routes');
const adminRoutes        = require('./routes/admin.routes');
const proposalRoutes     = require('./routes/proposal.routes');
const repositoryRoutes   = require('./routes/repository.routes');
const notificationRoutes = require('./routes/notification.routes');
const externalRoutes     = require('./routes/external.routes');
const reportRoutes       = require('./routes/report.routes');
const signatureRoutes    = require('./routes/signature.routes');
const announcementRoutes = require('./routes/announcement.routes');
const searchRoutes       = require('./routes/search.routes');
const terminalReportRoutes = require('./routes/terminalReport.routes');
const filesRoutes        = require('./routes/files.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

/* On Render the app sits behind a proxy: this lets req.ip be the visitor's address
   (used by the sign-in attempt limits) */
app.set('trust proxy', 1);
app.disable('x-powered-by');

/* Security headers: this server only sends JSON, so nothing may run or be framed */
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options':    'nosniff',
    'X-Frame-Options':           'DENY',
    'Referrer-Policy':           'no-referrer',
    'Content-Security-Policy':   "default-src 'none'; frame-ancestors 'none'",
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'Strict-Transport-Security': 'max-age=15552000; includeSubDomains',
  });
  next();
});

/* Which websites may call this API.
   Live (Render): only the AYON website and FRONTEND_URL.
   On your own computer: also localhost and addresses on your local network. */
const isLive = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const envOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim().replace(/\/+$/, ''))
  : [];

const allowedOrigins = [
  'https://ayon-system.vercel.app',
  ...(isLive ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
  ...envOrigins
].filter(Boolean);
const isLocalNetwork = (o) => !isLive && (o.startsWith('http://10.') || o.startsWith('http://192.168.'));

app.use(cors({
  origin: (origin, callback) => {
    // Requests without an Origin (Postman, curl, server to server) carry no browser session, so they are allowed
    if (!origin || allowedOrigins.includes(origin) || isLocalNetwork(origin)) {
      return callback(null, true);
    }
    console.warn('Blocked by CORS:', origin);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 2 MB: enough for a signature image (1 MB at most) sent as text
app.use(express.json({ limit: '2mb' }));

app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
/* Terminal Report (Form 007): /api/proposals/:id/terminal-report and /api/terminal-reports */
app.use('/api',               terminalReportRoutes);
app.use('/api/proposals',     proposalRoutes);
app.use('/api/repository',    repositoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/external',      externalRoutes);
app.use('/api/reports',       reportRoutes);
app.use('/api/signatures',    signatureRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/search',        searchRoutes);
app.use('/api/files',         filesRoutes);     // short-lived links to private files, profile pictures

app.get('/', (req, res) => res.send('AYON API is running.'));

app.listen(PORT, () => console.log('Server started on port ' + PORT));