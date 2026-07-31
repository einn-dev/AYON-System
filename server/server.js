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

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/api/auth',          authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/proposals',     proposalRoutes);
app.use('/api/repository',    repositoryRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/grants',        grantRoutes);
app.use('/api/external',      externalRoutes);
app.use('/api/reports',       reportRoutes);

app.get('/', (req, res) => res.send('AYON API running on Supabase'));

app.listen(PORT, () => console.log('Server started on port ' + PORT));